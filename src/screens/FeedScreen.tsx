/**
 * FeedScreen — Full-screen TikTok/Reels-style feed.
 *
 * No overlay layers. Title, description, stats, and buttons
 * are displayed directly on the image with no dark gradient or
 * semi-transparent backgrounds blocking the view.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, TextInput, Dimensions, Animated, StatusBar,
  Platform, KeyboardAvoidingView, ScrollView, Keyboard, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TrustBar } from "../components/shared/TrustBar";
import { supabase, SUPABASE_URL } from "../core/supabase";
import { useSignals, useSignalsRealtime, signalStore, useSignalStore } from "../core/signalStore";
import { useRadius } from "../core/settingsStore";
import { clusterSignals, isCluster } from "../core/signalCluster";
import {
  Plus, X, ChevronLeft, ChevronRight, MapPin, Camera,
  ShieldAlert, Flame, Droplets, Car, UserSearch, HelpCircle,
  ShieldCheck, Clock as ClockIcon, Users,
  Eye, Video as VideoIcon, MoreVertical,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import type { Signal, SignalCluster, SignalCategory, SignalType } from "../core/types";
import { lightTap, mediumTap, heavyTap } from "../core/haptics";
import { Video, Audio } from "expo-av";
import { getForYouFeed, trackView, trackWatchTime, trackLike, trackComment } from "../core/forYouAlgorithm";
import { Heart, MessageCircle, Share2, Music, User } from "lucide-react-native";


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimeAgo(isoString: string): string {
  const commentDate = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - commentDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  return formatTime(diffMinutes);
}

const STATE_LABEL = (reports: number, trust: number) => {
  if (reports >= 20) return { label: "Verified", color: "#D8F3DC", textColor: "#2D6A4F" };
  if (trust >= 80) return { label: "High confidence", color: "#FEF3C7", textColor: "#F59E0B" };
  if (reports >= 3) return { label: "Emerging", color: "#FFEDD5", textColor: "#FF8C42" };
  return { label: "Unverified", color: "#E5E7EB", textColor: "#6B7280" };
};

const TABS = ["For You", "Near You", "Verified", "Alerts"] as const;
type Tab = (typeof TABS)[number];

const _mediaCache = new Map<string, MediaFile[]>();

type MediaFile = { id: string; storage_path: string; mime_type: string; };

function getStorageUrl(storagePath: string): string {
  if (!SUPABASE_URL) return "";
  return `${SUPABASE_URL}/storage/v1/object/public/signal-media/${storagePath}`;
}

async function prefetchMedia(signals: Signal[]) {
  const signalIds = signals.map((s) => s.id).filter((id) => !_mediaCache.has(id));
  if (signalIds.length === 0) return;
  try {
    const { data } = await supabase
      .from("media_files")
      .select("id, signal_id, storage_path, mime_type")
      .in("signal_id", signalIds)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as (MediaFile & { signal_id: string })[];
    const grouped = new Map<string, MediaFile[]>();
    for (const row of rows) {
      const list = grouped.get(row.signal_id);
      if (list) list.push({ id: row.id, storage_path: row.storage_path, mime_type: row.mime_type });
      else grouped.set(row.signal_id, [{ id: row.id, storage_path: row.storage_path, mime_type: row.mime_type }]);
    }
    for (const id of signalIds) {
      _mediaCache.set(id, grouped.get(id) ?? []);
    }
  } catch { /* silently fail */ }
}

function useMediaForSignal(signalId: string): { files: MediaFile[]; urls: string[] } {
  const [media, setMedia] = useState({ files: _mediaCache.get(signalId) ?? [], urls: [] });

  useEffect(() => {
    const updateMedia = () => {
      const files = _mediaCache.get(signalId) ?? [];
      const urls = files.map((f) => getStorageUrl(f.storage_path));
      setMedia({ files, urls });
    };

    // Initial update
    updateMedia();

    // We can use a simple timer to recheck periodically since we don't have an event emitter
    const interval = setInterval(updateMedia, 500);

    return () => clearInterval(interval);
  }, [signalId]);

  return media;
}

interface IncidentCardProps {
  signal: Signal;
  cardHeight: number;
  onLike?: (signalId: string) => void;
  onComment?: (signalId: string) => void;
  onShare?: (signalId: string) => void;
}

function IncidentCard({ signal, cardHeight }: IncidentCardProps) {
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const buttonsPressedRef = useRef(false);
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [liked, setLiked] = useState(signal.liked_by_user || false);
  const [likeCount, setLikeCount] = useState(signal.likes || 0);
  const [commentCount, setCommentCount] = useState(signal.comments || 0);
  const [shareCount, setShareCount] = useState(signal.shares || 0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; username: string; text: string; created_at: string }>>([]);
  const watchStartTime = useRef<number>(Date.now());
  const videoDuration = useRef<number>(0);

  // Load comments when showComments changes to true
  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('signal_comments')
        .select(`id, text, created_at, user_id`)
        .eq('signal_id', signal.id)
        .order('created_at', { ascending: false });

      console.log('[loadComments] Loaded comments:', { data, error });

      if (error) {
        console.error('[loadComments] Error loading comments:', error);
        return;
      }

      if (data) {
        const formattedComments = data.map((c: any) => ({
          id: c.id,
          username: 'User', // We'll just show "User" for now since we can't join profiles
          text: c.text,
          created_at: c.created_at
        }));
        setComments(formattedComments);
      }
    } catch (e) {
      console.error('[loadComments] Exception:', e);
    }
  };

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, signal.id]);

  useEffect(() => {
    // Configure audio session to play through speaker
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.warn("Failed to configure audio session:", e);
      }
    };
    configureAudio();
  }, []);

  // Track watch time when component unmounts or stops playing
  useEffect(() => {
    return () => {
      const watchTime = (Date.now() - watchStartTime.current) / 1000;
      if (watchTime > 1) {
        trackWatchTime(signal.id, signal.category, watchTime, videoDuration.current || 30);
      }
    };
  }, [signal.id, signal.category]);

  const hasMedia = signal.media > 0;
  const { files: mediaFiles, urls: mediaUrls } = useMediaForSignal(signal.id);
  const currentUrl = mediaUrls[0] ?? null;
  const currentMedia = mediaFiles[0] ?? null;
  const isVideo = currentMedia?.mime_type?.startsWith("video/");
  console.log("[IncidentCard]", { signalId: signal.id, isVideo, currentUrl, mediaFiles });
  const state = STATE_LABEL(signal.reports, signal.trust);

  const handleTogglePlay = () => {
    if (isVideo) {
      setIsPlaying(!isPlaying);
    }
  };

  const handleCopyLink = async () => {
    if (currentUrl) {
      try {
        await Clipboard.setStringAsync(currentUrl);
        alert("Link copied!");
      } catch (e) {
        alert("Failed to copy link");
      }
    }
    setMenuOpen(false);
  };

  const handleDownload = async () => {
    if (currentUrl) {
      try {
        const { writeAsStringAsync, documentDirectory } = await import("expo-file-system");
        const response = await fetch(currentUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const ext = currentUrl.split('.').pop() || 'mp4';
        const fileName = `${Date.now()}.${ext}`;
        const filePath = `${documentDirectory}${fileName}`;
        await writeAsStringAsync(filePath, base64, { encoding: 'base64' });
        alert("Downloaded to your documents!");
      } catch (e) {
        alert("Failed to download video");
      }
    }
    setMenuOpen(false);
  };

  const handleVerify = async () => {
    buttonsPressedRef.current = true;
    setVerifying(true); setErr(null);
    const r = await signalStore.verify(signal.id);
    setVerifying(false);
    if (!r.ok) setErr(r.error ?? "Couldn't verify");
  };

  const handleLike = () => {
    heavyTap();
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    trackLike(signal.id, signal.category, !liked);
  };

  const handleOpenComments = () => {
    mediumTap();
    setShowComments(true);
  };

  const handleSubmitComment = async () => {
    if (newComment.trim()) {
      mediumTap();
      const now = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[handleSubmitComment] User:', user);
      if (user) {
        try {
          // Insert comment to DB (without trying to join profiles in insert select)
          const { data: insertedComment, error } = await supabase
            .from('signal_comments')
            .insert({
              signal_id: signal.id,
              user_id: user.id,
              text: newComment.trim(),
              created_at: now
            })
            .select('id, text, created_at')
            .single();

          console.log('[handleSubmitComment] Insert result:', { insertedComment, error });

          if (error) {
            console.error('[handleSubmitComment] Error inserting comment:', error);
            alert('Failed to post comment: ' + error.message);
          }

          // Update comments state
          if (insertedComment) {
            const formattedComment = {
              id: insertedComment.id,
              username: 'You',
              text: insertedComment.text,
              created_at: insertedComment.created_at
            };
            setComments(prev => [formattedComment, ...prev]);
          } else {
            // Fallback if insert fails
            const comment = {
              id: Date.now().toString(),
              username: 'You',
              text: newComment.trim(),
              created_at: now
            };
            setComments(prev => [comment, ...prev]);
          }
        } catch (e) {
          console.error('[handleSubmitComment] Exception:', e);
          const comment = {
            id: Date.now().toString(),
            username: 'You',
            text: newComment.trim(),
            created_at: now
          };
          setComments(prev => [comment, ...prev]);
        }
      } else {
        const comment = {
          id: Date.now().toString(),
          username: 'You',
          text: newComment.trim(),
          created_at: now
        };
        setComments(prev => [comment, ...prev]);
      }

      setCommentCount(prev => prev + 1);
      setNewComment('');
      trackComment(signal.id, signal.category);

      // Update the signal in the store
      const store = useSignalStore.getState();
      const updatedSignals = store.signals.map(s => {
        if (s.id === signal.id) {
          return { ...s, comments: (s.comments || 0) + 1 };
        }
        return s;
      });
      store._replaceSignals(updatedSignals);
    }
  };

  const handleShare = async () => {
    mediumTap();
    const shareText = `${signal.title}\n${signal.description || ''}\n\nCheck out this report on Swift Watch!`;
    try {
      await Clipboard.setStringAsync(shareText);
      // Show a quick alert that it's copied
      alert('Link copied to clipboard!');
    } catch (e) {
      console.error('Failed to copy:', e);
    }
    // Update the share count locally
    const newShareCount = shareCount + 1;
    setShareCount(newShareCount);
    // Update the signal in the store
    const store = useSignalStore.getState();
    const updatedSignals = store.signals.map(s => {
      if (s.id === signal.id) {
        return { ...s, shares: newShareCount };
      }
      return s;
    });
    store._replaceSignals(updatedSignals);
  };

  if (hasMedia) {
    return (
      <View style={[styles.cardContainer, { height: cardHeight }]}>
        {/* Media as background */}
        <TouchableOpacity
          style={styles.cardMediaImage}
          onPress={handleTogglePlay}
          activeOpacity={1}
          onLongPress={handleLike}
          delayLongPress={300}
        >
          {currentUrl && isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: currentUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode={Video.RESIZE_MODE_COVER}
              isLooping
              isMuted={isMuted}
              shouldPlay={isPlaying}
              rate={speed}
              onError={(e) => console.log("Video load error:", e)}
              onReadyForDisplay={() => console.log("Video ready for display")}
              onStatusUpdate={(status) => {
                if (status.durationMillis) {
                  videoDuration.current = status.durationMillis / 1000;
                }
              }}
            />
          ) : currentUrl && !isVideo ? (
            <Image
              source={{ uri: currentUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.mediaBg} />
          )}
        </TouchableOpacity>

        {/* Dark gradient overlay for readability */}
        <View style={styles.gradientOverlay} pointerEvents="none" />

        {/* Three-dot menu button */}
        {isVideo && currentUrl && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuOpen(!menuOpen)}
          >
            <MoreVertical size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* State badge at top-left */}
        <View style={[styles.badgeTopLeft]}>
          <View style={[styles.stateBadge, { backgroundColor: state.color }]}>
            <Text style={[styles.stateText, { color: state.textColor }]}>{state.label}</Text>
          </View>
        </View>

        {/* TikTok-style Right Sidebar Actions */}
        <View style={styles.rightSidebar}>
          {/* Profile */}
          <View style={styles.sidebarItem}>
            <View style={styles.profileIcon}>
              <User size={28} color="#FFF" />
            </View>
          </View>

          {/* Like */}
          <TouchableOpacity style={styles.sidebarItem} onPress={handleLike} activeOpacity={0.7}>
            <Heart
              size={32}
              color={liked ? "#FF3B30" : "#FFFFFF"}
              fill={liked ? "#FF3B30" : "none"}
            />
            <Text style={styles.sidebarText}>{likeCount}</Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={styles.sidebarItem} onPress={handleOpenComments} activeOpacity={0.7}>
            <MessageCircle size={32} color="#FFFFFF" />
            <Text style={styles.sidebarText}>{commentCount}</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.sidebarItem} onPress={handleShare} activeOpacity={0.7}>
            <Share2 size={32} color="#FFFFFF" />
            <Text style={styles.sidebarText}>{shareCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Info at bottom - TikTok style */}
        <View style={styles.infoBottom}>
          <Text style={styles.usernameText}>@swift_watch</Text>
          <Text style={styles.titleText} numberOfLines={2}>{signal.title}</Text>
          {signal.description && (
            <Text style={styles.descText} numberOfLines={2}>{signal.description}</Text>
          )}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MapPin size={12} color="#FFFFFF" />
              <Text style={styles.statText}>{signal.distanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.statItem}>
              <ClockIcon size={12} color="#FFFFFF" />
              <Text style={styles.statText}>{formatTime(signal.minutesAgo)}</Text>
            </View>
            <View style={styles.statItem}>
              <Users size={12} color="#FFFFFF" />
              <Text style={styles.statText}>{signal.reports} reports</Text>
            </View>
          </View>
        </View>
        {/* Drawer menu */}
        {menuOpen && (
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
          >
            <View style={styles.menuDrawer}>
              <TouchableOpacity style={styles.menuItem} onPress={handleCopyLink}>
                <Text style={styles.menuItemText}>Copy Video Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleDownload}>
                <Text style={styles.menuItemText}>Download Video</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <Text style={styles.menuSectionTitle}>Playback Speed</Text>
              {[0.5, 1.0, 1.5, 2.0].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.menuItem, speed === s && styles.menuItemActive]}
                  onPress={() => { setSpeed(s); setMenuOpen(false); }}
                >
                  <Text style={[styles.menuItemText, speed === s && styles.menuItemTextActive]}>
                    {s.toFixed(1)}x
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setIsMuted(!isMuted); setMenuOpen(false); }}
              >
                <Text style={styles.menuItemText}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        {/* Comments Modal */}
        {showComments && (
          <Modal visible={showComments} transparent animationType="slide">
            <TouchableOpacity
              style={styles.commentsOverlay}
              activeOpacity={1}
              onPress={() => setShowComments(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.commentsContainer}
              >
                <View style={styles.commentsHeader}>
                  <Text style={styles.commentsTitle}>{commentCount} Comments</Text>
                  <TouchableOpacity onPress={() => setShowComments(false)}>
                    <X size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.commentsList}>
                  {comments.length === 0 ? (
                    <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
                  ) : (
                    comments.map((comment) => (
                      <View key={comment.id} style={styles.commentItem}>
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>{comment.username[0]}</Text>
                        </View>
                        <View style={styles.commentContent}>
                          <Text style={styles.commentUsername}>{comment.username}</Text>
                          <Text style={styles.commentText}>{comment.text}</Text>
                          <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
                        </View>
                        <TouchableOpacity>
                          <Heart size={16} color="#999" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment..."
                    placeholderTextColor="#999"
                    value={newComment}
                    onChangeText={setNewComment}
                    onSubmitEditing={handleSubmitComment}
                  />
                  <TouchableOpacity
                    style={[styles.postButton, !newComment.trim() && styles.postButtonDisabled]}
                    onPress={handleSubmitComment}
                    disabled={!newComment.trim()}
                  >
                    <Text style={styles.postButtonText}>Post</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    );
  }

  // No media card — dark background
  return (
    <View style={[styles.cardContainer, styles.cardNoMedia, { height: cardHeight }]}>
      <View style={styles.noMediaWrap}>
        <View style={styles.noMediaTop}>
          <View style={[styles.stateBadge, { backgroundColor: state.color }]}>
            <Text style={[styles.stateText, { color: state.textColor }]}>{state.label}</Text>
          </View>
          <Text style={[styles.typeText, { color: "#9CA3AF" }]}>{signal.type}</Text>
        </View>
        <View style={styles.noMediaCenter}>
          <Text style={[styles.noMediaTitle, { color: "#FFF", textAlign: "center" }]}>{signal.title}</Text>
          {signal.description && (
            <Text style={[styles.noMediaDesc, { color: "#D1D5DB", textAlign: "center" }]}>{signal.description}</Text>
          )}
        </View>
        <View style={styles.infoBottom}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MapPin size={11} color="#FFFFFF" />
              <Text style={styles.statText}>{signal.distanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.statItem}>
              <ClockIcon size={11} color="#FFFFFF" />
              <Text style={styles.statText}>{formatTime(signal.minutesAgo)}</Text>
            </View>
            <View style={styles.statItem}>
              <Users size={11} color="#FFFFFF" />
              <Text style={styles.statText}>{signal.reports} reports</Text>
            </View>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => { mediumTap(); handleVerify(); }}
              disabled={verifying}
            >
              <ShieldCheck size={14} color="#FFF" />
              <Text style={styles.confirmBtnText}>{verifying ? "..." : "Confirm"}</Text>
            </TouchableOpacity>
            {["Still active", "Resolved", "False alarm"].map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chipBtn, { borderColor: "#4B5563" }]}
                onPress={() => { buttonsPressedRef.current = true; lightTap(); }}
              >
                <Text style={[styles.chipText, { color: "#D1D5DB" }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {err && <Text style={styles.errorText}>{err}</Text>}
        </View>
      </View>
    </View>
  );
}

function ClusterSnapCard({ cluster, cardHeight }: { cluster: SignalCluster; cardHeight: number }) {
  return (
    <View style={[styles.cardContainer, styles.cardNoMedia, { height: cardHeight }]}>
      <View style={styles.noMediaWrap}>
        <View style={styles.noMediaCenter}>
          <Text style={[styles.noMediaTitle, { color: "#FFF", textAlign: "center", marginBottom: 8 }]}>
            {cluster.signals.length} signals near {cluster.location}
          </Text>
          <Text style={[styles.noMediaDesc, { color: "#D1D5DB", textAlign: "center", marginBottom: 16 }]}>
            Avg trust {cluster.avgTrust}% · {cluster.totalReports} total reports
          </Text>
          {cluster.signals.slice(0, 5).map((s) => (
            <View key={s.id} style={styles.clusterRow}>
              <View style={[styles.clusterDot, { backgroundColor: s.trust >= 60 ? "#E63946" : "#2D6A4F" }]} />
              <Text style={styles.clusterRowText} numberOfLines={1}>{s.title}</Text>
            </View>
          ))}
          {cluster.signals.length > 5 && (
            <Text style={styles.clusterMore}>+{cluster.signals.length - 5} more</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const [tab, setTab] = useState<Tab>("For You");
  const [open, setOpen] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);
  const [processedSignals, setProcessedSignals] = useState<Signal[]>([]);
  const signals = useSignals();
  const maxRadius = useRadius();
  const insets = useSafeAreaInsets();
  useSignalsRealtime();

  useEffect(() => {
    if (signals.length > 0) prefetchMedia(signals).catch(() => {});
  }, [signals]);

  // Apply algorithm when signals or tab changes
  useEffect(() => {
    const processSignals = async () => {
      let filtered = signals.filter((s) => {
        if (tab === "Verified") return s.type === "verified";
        if (tab === "Alerts") return s.trust >= 70;
        if (tab === "Near You") return s.distanceKm <= maxRadius;
        return true;
      });

      // Apply the ultimate algorithm for "For You"
      if (tab === "For You") {
        filtered = await getForYouFeed(filtered);
      }

      setProcessedSignals(filtered);
    };

    processSignals();
  }, [signals, tab, maxRadius]);

  const onLayout = useCallback((e: any) => {
    const h = e.nativeEvent?.layout?.height ?? 0;
    if (h > 0) setContainerHeight(h);
  }, []);

  const grouped = clusterSignals(processedSignals);

  const renderItem = ({ item }: { item: Signal | SignalCluster }) => {
    if (containerHeight === 0) return null;
    if (isCluster(item)) {
      return <ClusterSnapCard cluster={item} cardHeight={containerHeight} />;
    }
    return <IncidentCard signal={item} cardHeight={containerHeight} />;
  };

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    viewableItems.forEach(({ item }: any) => {
      if (!isCluster(item)) {
        trackView(item.id, item.category);
      }
    });
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.feedArea} onLayout={onLayout}>
        {containerHeight > 0 && (
          <FlatList
            data={grouped}
            keyExtractor={(item) => (isCluster(item) ? item.id : item.id)}
            renderItem={renderItem}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            snapToAlignment="start"
            getItemLayout={(_, idx) => ({ length: containerHeight, offset: containerHeight * idx, index: idx })}
            ListEmptyComponent={
              <View style={[styles.empty, { height: containerHeight }]}>
                <Text style={styles.emptyText}>No signals in this view.</Text>
              </View>
            }
          />
        )}
        <View style={[styles.filterOverlay, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
          {TABS.map((t) => (
            <TouchableOpacity key={t} onPress={() => { lightTap(); setTab(t); }}>
              <Text style={[styles.filterText, tab === t && styles.filterTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={[styles.fabWrapper, { paddingBottom: 24 + insets.bottom }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.fab}
          onPress={() => { mediumTap(); setOpen(true); }}
          accessibilityLabel="Create report"
        >
          <Plus size={24} color="#FFF" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
      {open && <CreateModal onClose={() => setOpen(false)} />}
    </View>
  );
}

// ─── Create Modal ───
type IncidentCategory = { key: SignalCategory; label: string; type: SignalType; Icon: React.ComponentType<{ size?: number; color?: string }>; color: string; };
const CATEGORIES: IncidentCategory[] = [
  { key: "crime", label: "Crime", type: "incident", Icon: ShieldAlert, color: "#E63946" },
  { key: "fire", label: "Fire", type: "incident", Icon: Flame, color: "#FF8C42" },
  { key: "flood", label: "Flood", type: "update", Icon: Droplets, color: "#2D6A4F" },
  { key: "accident", label: "Accident", type: "incident", Icon: Car, color: "#F59E0B" },
  { key: "missing", label: "Missing person", type: "update", Icon: UserSearch, color: "#1A1A2E" },
  { key: "other", label: "Other", type: "observation", Icon: HelpCircle, color: "#6B7280" },
];

function CreateModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [cat, setCat] = useState<IncidentCategory | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"loading" | "locked" | "error">("loading");
  const [uploading, setUploading] = useState(false);
  const [validationErr, setValidationErr] = useState<string | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const getLocation = async () => {
      try {
        const { getCurrentPositionAsync, requestForegroundPermissionsAsync, reverseGeocodeAsync } = await import("expo-location");
        const { status } = await requestForegroundPermissionsAsync();
        if (status !== "granted") { if (!cancelled) { setGpsStatus("error"); setLocation("Ikeja, Lagos"); } return; }
        const pos = await getCurrentPositionAsync({});
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus("locked");
        try {
          const geocode = await reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          if (geocode && geocode.length > 0 && !cancelled) {
            const g = geocode[0]; const parts = [g.street, g.district, g.city, g.region].filter(Boolean);
            setLocation(parts.slice(0,2).join(", ") || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
          } else if (!cancelled) setLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        } catch { if (!cancelled) setLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`); }
      } catch { if (!cancelled) { setGpsStatus("error"); setLocation("Ikeja, Lagos"); } }
    };
    getLocation();
    const watchPos = async () => {
      try { const { watchPositionAsync } = await import("expo-location"); const sub = await watchPositionAsync({ accuracy: 6, timeInterval: 10000 }, (pos) => { if (!cancelled) { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus("locked"); } }); setGpsWatchId(sub); } catch {}
    };
    watchPos();
    return () => { cancelled = true; if (gpsWatchId?.remove) gpsWatchId.remove(); };
  }, []);

  const pickMedia = async () => {
    try {
      const ImagePicker: any = await import("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setValidationErr("Camera roll permission is required."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"], 
        allowsMultipleSelection: true, 
        quality: 0.7, // Lower quality for faster processing
        selectionLimit: 5 - mediaFiles.length, 
        base64: true,
      });
      console.log("[pickMedia] Result:", result);
      if (!result.canceled && result.assets) { 
        console.log("[pickMedia] Assets selected:", result.assets.length);
        setMediaFiles((prev) => [...prev, ...result.assets]); 
        setValidationErr(null); 
      }
    } catch (e: any) { 
      console.error("[pickMedia] Error:", e);
      setValidationErr("Couldn't open photo picker: " + (e.message || "unknown")); 
    }
  };

  const removeMedia = (idx: number) => setMediaFiles((prev) => prev.filter((_, i) => i !== idx));

  const uploadMedia = async (signalId: string) => {
    if (mediaFiles.length === 0) return 0;
    setUploading(true);
    let uploaded = 0;
    try {
      const { supabase } = await import("../core/supabase");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setUploading(false); return 0; }
      
      for (const asset of mediaFiles) {
        console.log("[uploadMedia] Processing asset:", asset);
        const ext = asset.uri?.split(".").pop() || "jpg";
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const storagePath = `${auth.user.id}/${fileName}`;
        const mimeType = asset.mimeType || "image/jpeg";
        console.log("[uploadMedia] Uploading to:", storagePath, "with MIME type:", mimeType);
        
        let uploadData: Uint8Array;
        let fileSize: number;
        
        try {
          // Try using expo-file-system's legacy readAsStringAsync to get base64
          console.log("[uploadMedia] Reading file with legacy expo-file-system API...");
          const { readAsStringAsync } = await import("expo-file-system/legacy");
          const b64 = await readAsStringAsync(asset.uri, { encoding: "base64" as any });
          
          // Create a Uint8Array from base64 (don't use Blob in React Native)
          const byteCharacters = atob(b64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          uploadData = new Uint8Array(byteNumbers);
          fileSize = uploadData.length;
          
          console.log("[uploadMedia] Successfully read file, size:", fileSize, "bytes");
          
          // Verify size matches
          if (asset.fileSize && fileSize !== asset.fileSize) {
            console.warn("[uploadMedia] Size mismatch! Expected:", asset.fileSize, "Got:", fileSize);
          }
        } catch (readErr) {
          console.error("[uploadMedia] Failed to read file:", readErr);
          continue;
        }
        
        // Upload to Supabase Storage using Uint8Array directly
        console.log("[uploadMedia] Starting Supabase upload...");
        const uploadResult = await supabase.storage
          .from("signal-media")
          .upload(storagePath, uploadData, { 
            contentType: mimeType, 
            upsert: true,
          });
          
        if (uploadResult?.error) { 
          console.error("[uploadMedia] Upload failed:", uploadResult.error); 
          continue; 
        }
        
        console.log("[uploadMedia] Upload successful!", uploadResult.data);
        
        // Get public URL to verify
        const { data: publicUrlData } = supabase.storage
          .from("signal-media")
          .getPublicUrl(storagePath);
          
        console.log("[uploadMedia] Public URL:", publicUrlData.publicUrl);
        
        // Link to media_files table
        const dbFileSize = asset.fileSize || fileSize;
        const { error: linkErr } = await (supabase as any).from("media_files").insert({
          signal_id: signalId, user_id: auth.user.id, storage_path: storagePath, mime_type: mimeType, file_size: dbFileSize,
        });
        if (linkErr) {
          console.warn("[uploadMedia] Link failed:", linkErr); 
        } else {
          uploaded++;
          console.log("[uploadMedia] Successfully linked media file");
        }
      }
    } catch (e: any) { 
      console.error("[uploadMedia] Exception:", e.message, e.stack); 
    }
    setUploading(false);
    _mediaCache.delete(signalId);
    console.log("[uploadMedia] Total uploaded:", uploaded);
    return uploaded;
  };

  const titleValid = title.trim().length > 0;
  const descValid = desc.trim().length > 0;

  const submit = async () => {
    if (!cat || !titleValid || !descValid) { setValidationErr("Please fill in title and description."); return; }
    onClose();
    console.log("[submit] Starting addAndPersist...");
    const signal = await signalStore.addAndPersist({ type: cat.type, category: cat.key, title: title.trim(), description: desc.trim(), location, lat: coords?.lat, lng: coords?.lng, mediaCount: mediaFiles.length });
    console.log("[submit] addAndPersist complete, signal ID:", signal.id);
    
    // Wait a second to make sure the signal is in the store with the real DB ID
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (mediaFiles.length > 0) {
      console.log("[submit] Starting media upload...");
      uploadMedia(signal.id).catch((e) => console.warn("[submit] background upload failed:", e?.message ?? e));
    }
  };

  const next = () => {
    if (step === 1) { if (!titleValid) { setValidationErr("Please enter a title for this report."); return; } if (!descValid) { setValidationErr("Please describe what's happening."); return; } }
    setValidationErr(null); setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Modal transparent animationType="slide" visible>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={createStyles.overlay}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => Keyboard.dismiss()} activeOpacity={1}>
            <View style={createStyles.modal}>
              <View style={createStyles.handle} />
              <View style={createStyles.topRow}>
                <View style={createStyles.topLeft}>
                  {step > 0 && <TouchableOpacity onPress={back} style={createStyles.iconBtn}><ChevronLeft size={18} color="#1A1A2E" /></TouchableOpacity>}
                  <Text style={createStyles.stepTitle}>{["Type","Details","Media","Location","Review"][step]}</Text>
                </View>
                <TouchableOpacity onPress={() => { lightTap(); onClose(); }} style={createStyles.iconBtn}><X size={18} color="#1A1A2E" /></TouchableOpacity>
              </View>
              <View style={createStyles.progressRow}>{[0,1,2,3,4].map((i) => (<View key={i} style={[createStyles.progressDot, i <= step && createStyles.progressDotActive]} />))}</View>
              {validationErr && <View style={createStyles.validationBanner}><Text style={createStyles.validationText}>{validationErr}</Text></View>}
              {step === 0 ? (
                <View style={createStyles.categoryGrid}>{CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.key} style={[createStyles.categoryCard, cat?.key === c.key && createStyles.categoryCardActive]} onPress={() => { lightTap(); setCat(c); next(); }}>
                    <View style={[createStyles.categoryIconWrap, { backgroundColor: c.color + "20" }]}><c.Icon size={20} color={c.color} /></View>
                    <Text style={createStyles.categoryLabel}>{c.label}</Text>
                  </TouchableOpacity>
                ))}</View>
              ) : step === 1 ? (
                <View style={createStyles.stepContent}>
                  <TextInput value={title} onChangeText={(v) => { setTitle(v); setValidationErr(null); }} placeholder={cat ? `${cat.label} — short title *` : "Title *"} placeholderTextColor="#9CA3AF" style={[createStyles.inputField, !titleValid && title.length > 0 && createStyles.inputFieldError]} />
                  {!titleValid && title.length > 0 && <Text style={createStyles.fieldHint}>Required</Text>}
                  <TextInput value={desc} onChangeText={(v) => { setDesc(v); setValidationErr(null); }} placeholder="What's happening? *" placeholderTextColor="#9CA3AF" multiline numberOfLines={4} style={[createStyles.inputField, createStyles.textArea, !descValid && desc.length > 0 && createStyles.inputFieldError]} />
                  {!descValid && desc.length > 0 && <Text style={createStyles.fieldHint}>Required</Text>}
                </View>
              ) : step === 2 ? (
                <View style={createStyles.stepContent}>
                  <TouchableOpacity style={createStyles.mediaBtn} onPress={() => { lightTap(); pickMedia(); }}>
                    <Camera size={20} color="#6B7280" />
                    <Text style={createStyles.mediaBtnText}>{mediaFiles.length > 0 ? `${mediaFiles.length} file(s) selected — tap to add more` : "Add photo or video from gallery"}</Text>
                  </TouchableOpacity>
                  {mediaFiles.length > 0 && (<View style={createStyles.mediaPreviewRow}>{mediaFiles.map((f,i) => (
                    <View key={i} style={createStyles.mediaPreviewItem}>
                      <Text style={createStyles.mediaPreviewName} numberOfLines={1}>{f.fileName || f.uri?.split("/").pop() || `Photo ${i+1}`}</Text>
                      <TouchableOpacity onPress={() => removeMedia(i)} style={createStyles.mediaRemoveBtn}><X size={12} color="#E63946" /></TouchableOpacity>
                    </View>
                  ))}</View>)}
                  <Text style={createStyles.mediaHint}>Optional · helps verification confidence. Up to 5 photos or videos.</Text>
                </View>
              ) : step === 3 ? (
                <View style={createStyles.stepContent}>
                  <View style={createStyles.locationRow}>
                    <View style={[createStyles.gpsBadge, gpsStatus === "error" && createStyles.gpsBadgeError, gpsStatus === "loading" && createStyles.gpsBadgeLoading]}>
                      <MapPin size={14} color={gpsStatus === "locked" ? "#2D6A4F" : gpsStatus === "error" ? "#E63946" : "#F59E0B"} />
                      <Text style={[createStyles.gpsText, gpsStatus === "error" && { color: "#E63946" }, gpsStatus === "loading" && { color: "#F59E0B" }]}>
                        {gpsStatus === "locked" ? `GPS locked ${coords ? `(${coords.lat.toFixed(4)},${coords.lng.toFixed(4)})` : ""}` : gpsStatus === "loading" ? "Locating…" : "GPS unavailable"}
                      </Text>
                    </View>
                    <TextInput value={location} onChangeText={setLocation} placeholder="Address or area" placeholderTextColor="#9CA3AF" style={createStyles.locationInput} />
                  </View>
                  <Text style={createStyles.locationHint}>{gpsStatus === "locked" ? "Your current location is detected. You can adjust manually if needed." : gpsStatus === "loading" ? "Fetching your location…" : "Enable location permissions to auto-detect your area."}</Text>
                </View>
              ) : (
                <View style={createStyles.stepContent}>
                  <ReviewRow label="Type" value={cat?.label ?? "—"} />
                  <ReviewRow label="Title" value={title} />
                  <ReviewRow label="Description" value={desc} />
                  <ReviewRow label="Location" value={location} />
                  <ReviewRow label="Media" value={`${mediaFiles.length} file(s)`} />
                  {coords && <ReviewRow label="Coordinates" value={`${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`} />}
                  <View style={createStyles.confidenceBox}><Text style={createStyles.confidenceText}>Initial confidence: low. Will rise as neighbors confirm.</Text></View>
                </View>
              )}
              {step < 4 ? (
                <TouchableOpacity style={[createStyles.actionBtn, step === 0 && !cat && createStyles.actionBtnDisabled]} onPress={next} disabled={step === 0 && !cat}>
                  <Text style={createStyles.actionBtnText}>Continue</Text><ChevronRight size={18} color="#FFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={createStyles.actionBtn} onPress={() => { mediumTap(); submit(); }}>
                  <Text style={createStyles.actionBtnText}>Submit report</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (<View style={createStyles.reviewRow}><Text style={createStyles.reviewLabel}>{label}</Text><Text style={createStyles.reviewValue}>{value}</Text></View>);
}

// ─── Styles ───
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  feedArea: { flex: 1, position: "relative" },

  filterOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  filterText: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  filterTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  empty: { justifyContent: "center", alignItems: "center", backgroundColor: "#000", padding: 32 },
  emptyText: { fontSize: 15, color: "#9CA3AF", fontWeight: "500" },

  cardContainer: { width: SCREEN_W, overflow: "hidden", position: "relative" },
  cardNoMedia: { backgroundColor: "#111" },
  cardMediaImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  mediaBg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#1A1A2E" },
  videoOverlay: { justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  videoLabel: { color: "#FFF", fontSize: 14, fontWeight: "600", marginTop: 8 },

  // Badge positioned at top-left directly on image
  badgeTopLeft: {
    position: "absolute",
    top: 110,
    left: 16,
    zIndex: 5,
  },
  stateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stateText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  // Type at top-right
  typeTopRight: {
    position: "absolute",
    top: 110,
    right: 16,
    zIndex: 5,
  },
  typeText: { fontSize: 11, color: "#FFFFFF", textTransform: "capitalize", fontWeight: "600" },

  // Info at bottom — no background, just white text directly on image
  infoBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 100,
    zIndex: 5,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Outfit",
    color: "#FFFFFF",
    lineHeight: 26,
  },
  descText: {
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 18,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 6,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  confirmBtnText: { fontSize: 12, fontWeight: "600", color: "#FFF" },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  chipText: { fontSize: 10, fontWeight: "500", color: "#FFFFFF" },
  errorText: { textAlign: "center", fontSize: 11, color: "#E63946", marginTop: 4 },

  // Video menu
  menuButton: {
    position: "absolute",
    top: 110,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 20,
  },
  menuDrawer: {
    position: "absolute",
    top: 150,
    right: 16,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    width: SCREEN_W * 0.7,
    maxWidth: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: "rgba(45, 106, 79, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  menuItemText: {
    fontSize: 15,
    color: "#1A1A2E",
    fontWeight: "500",
  },
  menuItemTextActive: {
    color: "#2D6A4F",
    fontWeight: "700",
  },
  menuSectionTitle: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  playButtonOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -32 }, { translateY: -32 }],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 32,
    padding: 16,
  },

  // Pagination dots
  paginationDots: {
    position: "absolute",
    bottom: 210,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    zIndex: 5,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: "#FFF" },

  // Non-media content
  noMediaWrap: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  noMediaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noMediaCenter: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
  noMediaTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Outfit", lineHeight: 26 },
  noMediaDesc: { fontSize: 13, lineHeight: 18, marginTop: 4 },

  fabWrapper: {
    position: "absolute",
    bottom: 80,
    right: 0,
    zIndex: 20,
    paddingRight: 20,
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2D6A4F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  clusterRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  clusterDot: { width: 8, height: 8, borderRadius: 4 },
  clusterRowText: { fontSize: 13, color: "#D1D5DB", flex: 1 },
  clusterMore: { fontSize: 12, color: "#9CA3AF", marginTop: 4, textAlign: "center" },

  // TikTok-style right sidebar
  rightSidebar: {
    position: "absolute",
    right: 12,
    top: "40%",
    zIndex: 10,
    gap: 20,
    alignItems: "center",
  },
  sidebarItem: {
    alignItems: "center",
    gap: 4,
  },
  profileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  musicIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Gradient overlay for better text readability
  gradientOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 250,
    zIndex: 1,
    pointerEvents: "none",
    // Since we don't have expo-linear-gradient, let's use a semi-transparent black background
    // that gets darker towards the bottom
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  usernameText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },

  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  menuDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: 'rgba(45,106,79,0.2)',
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  menuItemText: {
    color: '#FFF',
    fontSize: 16,
  },
  menuItemTextActive: {
    fontWeight: '600',
    color: '#2D6A4F',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 12,
  },
  menuSectionTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  // Comments modal styles
  commentsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  commentsContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_H * 0.7,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: SCREEN_H * 0.5,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2D6A4F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  noCommentsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 32,
  },
  commentInputContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A2E',
  },
  postButton: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  postButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

const createStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modal: { backgroundColor: "#F7F8FB", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 12 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
  stepTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  progressRow: { flexDirection: "row", gap: 4, marginTop: 12, marginBottom: 16 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },
  progressDotActive: { backgroundColor: "#1A1A2E" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  categoryCard: { width: "31%", backgroundColor: "#FFF", borderRadius: 16, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "transparent", gap: 8 },
  categoryCardActive: { borderColor: "#2D6A4F", backgroundColor: "rgba(45,106,79,0.05)" },
  categoryIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  categoryLabel: { fontSize: 11, fontWeight: "600", color: "#1A1A2E", textAlign: "center" },
  stepContent: { gap: 8, marginBottom: 16 },
  inputField: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: "#1A1A2E" },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  mediaBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: "#FFF", borderWidth: 1, borderStyle: "dashed", borderColor: "#D1D5DB", borderRadius: 16, paddingVertical: 32 },
  mediaBtnText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  mediaHint: { fontSize: 11, color: "#9CA3AF", textAlign: "center" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#D8F3DC", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  gpsText: { fontSize: 11, fontWeight: "600", color: "#2D6A4F" },
  locationInput: { flex: 1, backgroundColor: "#E5E7EB", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, color: "#1A1A2E" },
  locationHint: { fontSize: 11, color: "#9CA3AF" },
  actionBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: "#2D6A4F", paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 15, fontWeight: "600", color: "#FFF" },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFF", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  reviewLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: "#6B7280" },
  reviewValue: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  confidenceBox: { backgroundColor: "rgba(45,106,79,0.1)", padding: 12, borderRadius: 16, marginTop: 4 },
  confidenceText: { fontSize: 11, color: "#2D6A4F", textAlign: "center" },
  validationBanner: { backgroundColor: "#FEE2E2", borderRadius: 12, padding: 10, marginBottom: 8 },
  validationText: { fontSize: 12, color: "#E63946", textAlign: "center", fontWeight: "600" },
  inputFieldError: { borderColor: "#E63946", borderWidth: 1.5 },
  fieldHint: { fontSize: 10, color: "#E63946", marginTop: -4, marginLeft: 4 },
  mediaPreviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  mediaPreviewItem: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#E5E7EB" },
  mediaPreviewName: { fontSize: 11, color: "#1A1A2E", maxWidth: 100 },
  mediaRemoveBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center" },
  gpsBadgeError: { backgroundColor: "#FEE2E2" },
  gpsBadgeLoading: { backgroundColor: "#FEF3C7" },
});