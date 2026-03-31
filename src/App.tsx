/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useState, useEffect, useRef } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, doc, setDoc, getDoc, getDocs, query, orderBy, where, onSnapshot, 
  addDoc, deleteDoc, updateDoc, serverTimestamp, handleFirestoreError, OperationType,
  type User, type DocumentData 
} from './firebase';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react';
import { 
  Globe, Home, MessageSquare, Map as MapIcon, User as UserIcon, LogOut, 
  Plus, Trash2, MessageCircle, Heart, Send, Camera, X, QrCode, ExternalLink,
  MapPin, Users, Activity, AlertCircle, ShieldAlert, Phone, ShieldCheck, Navigation, LifeBuoy, AlertTriangle, Flame, Ambulance,
  Sparkles, Image as ImageIcon, Video as VideoIcon, Video, Music, Search, Mic, Volume2, Languages, Info, Settings, Layout, Layers, Zap, Lock
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from './lib/utils';
import { TiltCard } from './components/TiltCard';
import { getDocFromServer } from 'firebase/firestore';

// Fix Leaflet marker icon issue
// @ts-ignore
if (typeof window !== 'undefined' && L.Icon.Default) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const DEFAULT_CENTER: [number, number] = [17.3850, 78.4867];

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMsg = "Something went wrong.";
      if (this.state.error && this.state.error.message) {
        try {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) errorMsg = parsed.error;
          else errorMsg = this.state.error.message;
        } catch (e) {
          errorMsg = this.state.error.message;
        }
      }

      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
          <div className="w-20 h-20 bg-red-600/20 border border-red-500/30 rounded-3xl flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Application Error</h2>
          <p className="text-slate-400 max-w-md mb-8">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold transition-all"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Types ---
interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: any;
  likesCount: number;
}

interface Message {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoneNumber?: string;
  recipientUid?: string;
  conversationId?: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: any;
}

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  uid?: string;
  createdAt: any;
}

interface GalleryItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  userId: string;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  parentPhoneNumber?: string;
  securityPassword?: string;
  photoURL?: string;
  bio?: string;
  houseNumber?: string;
  floorNumber?: string;
  blockName?: string;
  wallpaperStyle?: string;
  customWallpaperUrl?: string;
  createdAt: any;
}

// --- Components ---

// --- Hooks ---
const useLongPress = (callback: () => void, ms = 500) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    timeoutRef.current = setTimeout(callback, ms);
  };

  const stop = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};

// --- Components ---
interface PostCardProps {
  post: Post;
  user: User;
  onLongPress: () => void;
  onLike: (post: Post) => void;
  onDelete: (id: string) => void;
}

const PostCard = ({ post, user, onLongPress, onLike, onDelete }: PostCardProps) => {
  const longPressProps = useLongPress(onLongPress);

  return (
    <div 
      {...longPressProps}
      className="bg-slate-900/50 border border-white/10 rounded-3xl overflow-hidden active:bg-white/5 transition-colors"
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={post.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorUid}`} className="w-10 h-10 rounded-full border border-white/20" alt="" />
          <div>
            <div className="font-bold">{post.authorName}</div>
            <div className="text-xs text-slate-500">
              {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleTimeString() : 'Just now'}
            </div>
          </div>
        </div>
        {post.authorUid === user.uid && (
          <button onClick={() => onDelete(post.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-full">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <div className="px-4 pb-4 space-y-4">
        <p className="text-slate-200">{post.content}</p>
        {post.imageUrl && (
          <div className="perspective-1000">
            <TiltCard className="aspect-video bg-transparent">
              <img 
                src={post.imageUrl} 
                className="w-full h-full object-cover rounded-xl" 
                alt="Post" 
                referrerPolicy="no-referrer"
              />
            </TiltCard>
          </div>
        )}
        {post.videoUrl && (
          <div className="perspective-1000">
            <TiltCard className="aspect-video bg-transparent">
              <video 
                src={post.videoUrl} 
                className="w-full h-full object-cover rounded-xl" 
                controls
                playsInline
              />
            </TiltCard>
          </div>
        )}
        <div className="flex items-center gap-6 pt-2 border-t border-white/5">
          <button 
            onClick={() => onLike(post)}
            className="flex items-center gap-2 text-slate-400 hover:text-pink-400 transition-colors"
          >
            <Heart className={cn("w-5 h-5", post.likesCount > 0 && "fill-pink-400 text-pink-400")} />
            <span>{post.likesCount || 0}</span>
          </button>
          <button className="flex items-center gap-2 text-slate-400">
            <MessageCircle className="w-5 h-5" />
            <span>0</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChatMessageProps {
  msg: Message;
  user: User;
  onLongPress: () => void;
}

const ChatMessage = ({ msg, user, onLongPress }: ChatMessageProps) => {
  const longPressProps = useLongPress(onLongPress);

  return (
    <div 
      {...longPressProps}
      className={cn(
        "flex flex-col max-w-[85%] active:opacity-70 transition-opacity",
        msg.authorUid === user.uid ? "ml-auto items-end" : "items-start"
      )}
    >
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 px-2">
        <span>{msg.authorUid === user.uid ? 'You' : msg.authorName}</span>
        <span>•</span>
        <span>{msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}</span>
        {msg.authorUid !== user.uid && msg.authorPhoneNumber && (
          <div className="flex items-center gap-2 ml-2">
            <a 
              href={`tel:${msg.authorPhoneNumber}`}
              className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-full hover:bg-emerald-500/30 transition-all"
              title="Call"
            >
              <Phone className="w-3 h-3" />
            </a>
            <a 
              href={`facetime:${msg.authorPhoneNumber}`}
              className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-full hover:bg-indigo-500/30 transition-all"
              title="Video Call"
            >
              <VideoIcon className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
      <div className={cn(
        "p-3 rounded-2xl relative group",
        msg.authorUid === user.uid ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-800 text-slate-200 rounded-tl-none"
      )}>
        {msg.imageUrl && (
          <div className="mb-2 w-48 h-48">
            <TiltCard className="w-full h-full bg-transparent">
              <img src={msg.imageUrl} className="w-full h-full object-cover rounded-lg" alt="" referrerPolicy="no-referrer" />
            </TiltCard>
          </div>
        )}
        {msg.videoUrl && (
          <div className="mb-2 w-48 h-48">
            <TiltCard className="w-full h-full bg-transparent">
              <video src={msg.videoUrl} className="w-full h-full object-cover rounded-lg" controls playsInline />
            </TiltCard>
          </div>
        )}
        <div className="break-words">{msg.content}</div>
      </div>
    </div>
  );
};

const FloatingOrbs = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-slate-950">
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl opacity-20"
          style={{
            width: Math.random() * 400 + 200,
            height: Math.random() * 400 + 200,
            background: `radial-gradient(circle, ${['#4f46e5', '#7c3aed', '#db2777', '#2563eb'][i % 4]}, transparent)`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            x: [0, Math.random() * 200 - 100, 0],
            y: [0, Math.random() * 200 - 100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

const AuroraWallpaper = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-slate-950">
      <motion.div 
        animate={{
          background: [
            'radial-gradient(circle at 0% 0%, #4f46e5 0%, transparent 50%), radial-gradient(circle at 100% 100%, #db2777 0%, transparent 50%)',
            'radial-gradient(circle at 100% 0%, #7c3aed 0%, transparent 50%), radial-gradient(circle at 0% 100%, #2563eb 0%, transparent 50%)',
            'radial-gradient(circle at 0% 0%, #4f46e5 0%, transparent 50%), radial-gradient(circle at 100% 100%, #db2777 0%, transparent 50%)',
          ]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 opacity-40 blur-3xl"
      />
    </div>
  );
};

const NebulaWallpaper = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-black">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-[120px] opacity-30"
          style={{
            width: '80vw',
            height: '80vh',
            background: i === 0 ? 'radial-gradient(circle, #4c1d95, transparent)' : i === 1 ? 'radial-gradient(circle, #1e3a8a, transparent)' : 'radial-gradient(circle, #701a75, transparent)',
            left: i === 0 ? '-10%' : i === 1 ? '30%' : '10%',
            top: i === 0 ? '-10%' : i === 1 ? '40%' : '20%',
          }}
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 20 + i * 5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

const CustomImageWallpaper = ({ url }: { url?: string }) => {
  if (!url) return <div className="fixed inset-0 -z-10 bg-slate-950" />;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${url})` }}
      />
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
    </div>
  );
};

const ColonyWallpaper = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-slate-950">
      <div className="absolute inset-0 bg-radial-[at_50%_0%,#1e1b4b_0%,#020617_100%]" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      <motion.div 
        animate={{
          opacity: [0.1, 0.2, 0.1],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px]"
      />
      <motion.div 
        animate={{
          opacity: [0.1, 0.15, 0.1],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-emerald-600/20 blur-[120px]"
      />
    </div>
  );
};

const WallpaperManager = ({ style, customUrl }: { style: string, customUrl?: string }) => {
  switch (style) {
    case 'colony': return <ColonyWallpaper />;
    case '3d-grid': return <ThreeDWallpaper />;
    case 'orbs': return <FloatingOrbs />;
    case 'aurora': return <AuroraWallpaper />;
    case 'nebula': return <NebulaWallpaper />;
    case 'custom': return <CustomImageWallpaper url={customUrl} />;
    case 'minimal': return <div className="fixed inset-0 -z-10 bg-slate-950" />;
    default: return <ColonyWallpaper />;
  }
};
const ThreeDWallpaper = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 50, stiffness: 400 });
  const springY = useSpring(mouseY, { damping: 50, stiffness: 400 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set((e.clientX / window.innerWidth) - 0.5);
      mouseY.set((e.clientY / window.innerHeight) - 0.5);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  const gridRotateX = useTransform(springY, [-0.5, 0.5], [65, 55]);
  const gridRotateY = useTransform(springX, [-0.5, 0.5], [-5, 5]);
  const gridTranslateX = useTransform(springX, [-0.5, 0.5], [-50, 50]);
  const gridTranslateY = useTransform(springY, [-0.5, 0.5], [-50, 50]);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-slate-950">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-radial-[at_50%_50%,#1e1b4b_0%,#020617_100%]" />

      {/* 3D Grid */}
      <div className="absolute inset-0 perspective-1000 flex items-center justify-center">
        <motion.div 
          className="w-[200%] h-[200%] opacity-20"
          style={{
            backgroundImage: `linear-gradient(to right, #4f46e5 1px, transparent 1px), linear-gradient(to bottom, #4f46e5 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
            rotateX: gridRotateX,
            rotateY: gridRotateY,
            x: gridTranslateX,
            y: gridTranslateY,
            translateZ: -200,
          }}
        />
      </div>

      {/* Floating Orbs with Parallax */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl opacity-10"
          style={{
            width: Math.random() * 400 + 200,
            height: Math.random() * 400 + 200,
            background: `radial-gradient(circle, ${['#4f46e5', '#7c3aed', '#db2777', '#2563eb'][i % 4]}, transparent)`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            x: useTransform(springX, [-0.5, 0.5], [-(i + 1) * 40, (i + 1) * 40]),
            y: useTransform(springY, [-0.5, 0.5], [-(i + 1) * 40, (i + 1) * 40]),
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 10 + i,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Cursor Glow */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full blur-[150px] opacity-20 bg-indigo-500/30"
        style={{
          left: '50%',
          top: '50%',
          x: useTransform(springX, [-0.5, 0.5], [-400 - 150, -400 + 150]),
          y: useTransform(springY, [-0.5, 0.5], [-400 - 150, -400 + 150]),
        }}
      />
    </div>
  );
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'feed' | 'chat' | 'map' | 'profile'>('home');
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [isChatRecording, setIsChatRecording] = useState(false);
  const [isFeedRecording, setIsFeedRecording] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState<'chat' | 'post'>('chat');
  const [showPostModal, setShowPostModal] = useState(false);
  const [longPressedItem, setLongPressedItem] = useState<{ id: string, type: 'post' | 'message', authorUid: string, content: string } | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newPostVideo, setNewPostVideo] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatImage, setChatImage] = useState('');
  const [chatVideo, setChatVideo] = useState('');
  const [showChatMediaModal, setShowChatMediaModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showStopEmergencyModal, setShowStopEmergencyModal] = useState(false);
  const [stopEmergencyPassword, setStopEmergencyPassword] = useState('');
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [tempMediaUrl, setTempMediaUrl] = useState('');
  const [tempMediaType, setTempMediaType] = useState<'photo' | 'video'>('photo');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editHouse, setEditHouse] = useState('');
  const [editFloor, setEditFloor] = useState('');
  const [editBlock, setEditBlock] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editSecurityPassword, setEditSecurityPassword] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [chatSubTab, setChatSubTab] = useState<'messages' | 'directory' | 'contacts'>('messages');
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [activeChatPartner, setActiveChatPartner] = useState<UserProfile | Contact | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [wallpaperSettings, setWallpaperSettings] = useState({
    showThreeDWallpaper: true,
    wallpaperStyle: 'colony',
    customWallpaperUrl: ''
  });
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSafeZones([
      { id: '1', name: 'Colony Police Station', type: 'police', lat: 17.3850, lng: 78.4867 },
      { id: '2', name: 'Community Hospital', type: 'hospital', lat: 17.3890, lng: 78.4900 },
      { id: '3', name: 'Safe Zone Alpha', type: 'safe', lat: 17.3800, lng: 78.4800 },
    ]);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'post' | 'chat' | 'profile', mediaType: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      if (type === 'post') {
        if (mediaType === 'photo') setNewPostImage(base64String);
        else setNewPostVideo(base64String);
        setShowPostModal(true);
      } else if (type === 'chat') {
        if (mediaType === 'photo') setChatImage(base64String);
        else setChatVideo(base64String);
        setShowChatMediaModal(false);
      } else if (type === 'profile') {
        setEditPhoto(base64String);
      }
      
      // Save to gallery if it's a camera capture or explicitly requested
      if (type === 'chat' || type === 'post') {
        await saveToGallery(base64String, mediaType === 'photo' ? 'image' : 'video');
      }
      
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      return;
    }

    setIsTracking(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.error("Error getting initial position:", error);
      }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.error("Error watching position:", error);
        setIsTracking(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), orderBy('displayName'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
      setAllUsers(usersData);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editName,
        bio: editBio,
        houseNumber: editHouse,
        floorNumber: editFloor,
        blockName: editBlock,
        phoneNumber: editPhone,
        parentPhoneNumber: editParentPhone,
        securityPassword: editSecurityPassword,
        photoURL: editPhoto || user.photoURL,
      });
      setShowEditProfileModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // --- Media Logic ---
  const handleWallpaperFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (Firestore limit is 1MB, but we should stay well below that for profile docs)
      if (file.size > 800000) {
        alert("Image is too large. Please select an image under 800KB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const url = reader.result as string;
        setWallpaperSettings(s => ({ 
          ...s, 
          wallpaperStyle: 'custom', 
          customWallpaperUrl: url,
          showThreeDWallpaper: true 
        }));
        setShowWallpaperModal(false);

        // Persist to Firestore if user is logged in
        if (user) {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              wallpaperStyle: 'custom',
              customWallpaperUrl: url
            });
          } catch (error) {
            console.error("Error saving wallpaper to Firestore", error);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveToGallery = async (url: string, type: 'image' | 'video') => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'gallery'), {
        url,
        type,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'gallery');
    }
  };

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleMic = async (target: 'chat' | 'feed') => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const isCurrentlyRecording = target === 'chat' ? isChatRecording : isFeedRecording;

    if (isCurrentlyRecording) {
      recognitionRef.current.stop();
      if (target === 'chat') setIsChatRecording(false);
      else if (target === 'feed') setIsFeedRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Microphone access error:", err);
        alert("Could not access your microphone. Please ensure it is connected and you have granted permission.");
        return;
      }

      recognitionRef.current.stop();
      setIsChatRecording(false);
      setIsFeedRecording(false);
      transcriptRef.current = '';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        transcriptRef.current = text;
        if (target === 'chat') setChatMessage(text);
        else if (target === 'feed') setNewPostContent(text);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsChatRecording(false);
        setIsFeedRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsChatRecording(false);
        setIsFeedRecording(false);
      };

      try {
        recognitionRef.current.start();
        if (target === 'chat') setIsChatRecording(true);
        else if (target === 'feed') setIsFeedRecording(true);
      } catch (e) {
        console.error("Error starting recognition", e);
      }
    }
  };

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setActiveTab('home');
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfile(data);
          if (data.wallpaperStyle) {
            setWallpaperSettings(s => ({ 
              ...s, 
              wallpaperStyle: data.wallpaperStyle || '3d-grid',
              customWallpaperUrl: data.customWallpaperUrl || '',
              showThreeDWallpaper: data.wallpaperStyle !== 'none'
            }));
          }
        } else {
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
            createdAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'users', currentUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;

    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const pts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      const sortedPosts = [...pts].sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || Date.now();
        const timeB = b.createdAt?.toMillis?.() || Date.now();
        return timeB - timeA;
      });
      setPosts(sortedPosts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'posts'));

    const contactsQuery = query(collection(db, 'users', user.uid, 'contacts'), orderBy('name', 'asc'));
    const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
      const cts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
      setContacts(cts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/contacts`));

    return () => {
      unsubscribePosts();
      unsubscribeContacts();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    let q;
    if (activeChatPartner) {
      const partnerUid = (activeChatPartner as any).uid || (activeChatPartner as any).phoneNumber;
      const conversationId = [user.uid, partnerUid].sort().join('_');
      q = query(
        collection(db, 'messages'), 
        where('conversationId', '==', conversationId),
        orderBy('createdAt', 'asc')
      );
    } else {
      q = query(
        collection(db, 'messages'), 
        where('conversationId', '==', 'colony'),
        orderBy('createdAt', 'asc')
      );
    }

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      const sortedMsgs = [...msgs].sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || Date.now();
        const timeB = b.createdAt?.toMillis?.() || Date.now();
        return timeA - timeB;
      });
      setMessages(sortedMsgs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages'));

    return () => unsubscribeMessages();
  }, [user, activeChatPartner]);

  const handleTriggerEmergency = async () => {
    if (!user) return;
    try {
      setEmergencyActive(true);
      setShowEmergencyModal(false);
      
      // Automatically turn on location tracking
      startTracking();

      const getPos = () => new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      let lat = 0;
      let lng = 0;

      try {
        const position = await getPos();
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        setUserLocation([lat, lng]);
      } catch (err) {
        console.error("Error getting position for emergency:", err);
      }

      // Log emergency in Firestore
      await addDoc(collection(db, 'emergencies'), {
        uid: user.uid,
        userName: user.displayName || 'Anonymous',
        userEmail: user.email,
        timestamp: serverTimestamp(),
        status: 'active',
        location: { lat, lng }
      });

      // Share live location with emergency contacts
      const emergencyNumbers = ['6301620861'];
      if (profile?.parentPhoneNumber) {
        emergencyNumbers.push(profile.parentPhoneNumber);
      }

      for (const phone of emergencyNumbers) {
        const targetUser = allUsers.find(u => u.phoneNumber === phone);
        const partnerUid = targetUser?.uid || phone;
        const conversationId = [user.uid, partnerUid].sort().join('_');

        await addDoc(collection(db, 'messages'), {
          authorUid: user.uid,
          authorName: user.displayName || 'Anonymous',
          authorPhoneNumber: profile?.phoneNumber || '',
          recipientUid: partnerUid,
          conversationId: conversationId,
          content: `🚨 EMERGENCY SOS! I need help. My current location: https://www.google.com/maps?q=${lat},${lng}`,
          createdAt: serverTimestamp(),
        });
      }

      // Simulate finding safe zones based on current location (mocked for now)
      setSafeZones([
        { id: 1, name: 'Police Station 1', type: 'police', lat: lat + 0.01, lng: lng + 0.01 },
        { id: 2, name: 'City Hospital', type: 'hospital', lat: lat - 0.01, lng: lng + 0.02 },
        { id: 3, name: 'Safe House Alpha', type: 'safehouse', lat: lat + 0.02, lng: lng - 0.01 },
      ]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'emergencies');
    }
  };

  const handleCancelEmergency = () => {
    setShowStopEmergencyModal(true);
    setStopEmergencyPassword('');
  };

  const handleConfirmStopEmergency = () => {
    const correctPassword = profile?.securityPassword || '1234'; // Default to 1234 if not set
    if (stopEmergencyPassword === correctPassword) {
      setEmergencyActive(false);
      setSafeZones([]);
      setShowStopEmergencyModal(false);
      setStopEmergencyPassword('');
      stopTracking();
    } else {
      alert("Incorrect Security PIN. Emergency remains active.");
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleCreatePost = async () => {
    if (!user || !newPostContent.trim()) return;
    try {
      await addDoc(collection(db, 'posts'), {
        authorUid: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorPhoto: user.photoURL,
        content: newPostContent,
        imageUrl: newPostImage,
        videoUrl: newPostVideo,
        createdAt: serverTimestamp(),
        likesCount: 0,
      });
      setNewPostContent('');
      setNewPostImage('');
      setNewPostVideo('');
      setShowPostModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const handleLikePost = async (post: Post) => {
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        likesCount: (post.likesCount || 0) + 1
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handleSendMessage = async () => {
    if (!user || (!chatMessage.trim() && !chatImage && !chatVideo)) return;
    try {
      const partnerUid = activeChatPartner ? ((activeChatPartner as any).uid || (activeChatPartner as any).phoneNumber) : null;
      const conversationId = partnerUid ? [user.uid, partnerUid].sort().join('_') : 'colony';

      await addDoc(collection(db, 'messages'), {
        authorUid: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorPhoneNumber: profile?.phoneNumber || '',
        recipientUid: partnerUid,
        conversationId: conversationId,
        content: chatMessage,
        imageUrl: chatImage,
        videoUrl: chatVideo,
        createdAt: serverTimestamp(),
      });
      setChatMessage('');
      setChatImage('');
      setChatVideo('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  const handleAddContact = async () => {
    if (!user || !newContactName.trim() || !newContactPhone.trim()) return;
    try {
      // Check if user exists with this phone number
      const userMatch = allUsers.find(u => u.phoneNumber === newContactPhone);
      
      await addDoc(collection(db, 'users', user.uid, 'contacts'), {
        name: newContactName,
        phoneNumber: newContactPhone,
        uid: userMatch?.uid || null,
        createdAt: serverTimestamp(),
      });
      setNewContactName('');
      setNewContactPhone('');
      setShowAddContactModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/contacts`);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'messages', messageId));
      setLongPressedItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `messages/${messageId}`);
    }
  };

  const handleShareItem = (content: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'ColonyConnect',
        text: content,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(content);
      alert('Content copied to clipboard!');
    }
    setLongPressedItem(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 text-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("h-screen w-full flex flex-col items-center justify-center text-white p-6", !wallpaperSettings.showThreeDWallpaper && "bg-slate-950")}>
        {wallpaperSettings.showThreeDWallpaper && <WallpaperManager style={wallpaperSettings.wallpaperStyle} customUrl={wallpaperSettings.customWallpaperUrl} />}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/50">
            <Globe className="w-12 h-12" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">ColonyConnect</h1>
          <p className="text-slate-400 text-lg">
            Connect with your colony in a whole new dimension. Real-time chat, community feeds, and interactive maps.
          </p>
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-white text-slate-950 font-bold rounded-2xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-3 text-lg"
          >
            <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("h-screen w-full text-white flex flex-col overflow-hidden", !wallpaperSettings.showThreeDWallpaper && "bg-slate-950")}>
      {wallpaperSettings.showThreeDWallpaper && <WallpaperManager style={wallpaperSettings.wallpaperStyle} customUrl={wallpaperSettings.customWallpaperUrl} />}

      {/* --- Header --- */}
      <header className="p-4 flex items-center justify-between bg-slate-900/50 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">ColonyConnect</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowWallpaperModal(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-2"
            title="Change Wallpaper"
          >
            <Layers className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-bold hidden sm:inline">Wallpaper</span>
          </button>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <LogOut className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full overflow-y-auto p-6 space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Welcome back, {user.displayName?.split(' ')[0]}! 👋</h2>
                <p className="text-slate-400">Here's what's happening in your colony today.</p>
              </div>

              {/* Google Search Bar */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const query = (e.currentTarget.elements.namedItem('search') as HTMLInputElement).value;
                    if (query) window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                  }}
                >
                  <input 
                    name="search"
                    type="text" 
                    placeholder="Search anything on Google..." 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
                  />
                  <button 
                    type="submit"
                    className="absolute inset-y-2 right-2 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Search
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-2xl space-y-2">
                  <Activity className="w-6 h-6 text-indigo-400" />
                  <div className="text-2xl font-bold">{posts.length}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Posts Today</div>
                </div>
                <div className="bg-pink-600/20 border border-pink-500/30 p-4 rounded-2xl space-y-2">
                  <MessageCircle className="w-6 h-6 text-pink-400" />
                  <div className="text-2xl font-bold">{messages.length}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Messages</div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold">Quick Access</h3>
                <div className="grid gap-4">
                  <button 
                    onClick={() => setActiveTab('feed')}
                    className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center">
                      <Plus className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold">Community Feed</div>
                      <div className="text-sm text-slate-400">See what others are sharing</div>
                    </div>
                  </button>
                  <button 
                    onClick={() => setActiveTab('chat')}
                    className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold">Group Chat</div>
                      <div className="text-sm text-slate-400">Chat with your neighbors</div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'feed' && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full overflow-y-auto p-4 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Community Feed</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/*';
                      input.onchange = (e: any) => handleFileSelect(e, 'post', 'video');
                      input.click();
                    }}
                    className="p-3 bg-pink-600/20 border border-pink-500/30 text-pink-400 rounded-full shadow-lg shadow-pink-600/10 hover:bg-pink-600/30 transition-all"
                    title="Quick Video Post"
                  >
                    <VideoIcon className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setShowPostModal(true)}
                    className="p-3 bg-indigo-600 rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
                    title="Create Post"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {posts.map((post) => (
                  <PostCard 
                    key={post.id}
                    post={post}
                    user={user}
                    onLongPress={() => setLongPressedItem({ id: post.id, type: 'post', authorUid: post.authorUid, content: post.content })}
                    onLike={handleLikePost}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full p-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold tracking-tight">ColonyChat</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/*';
                      input.onchange = (e: any) => handleFileSelect(e, 'chat', 'video');
                      input.click();
                    }}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10"
                    title="Upload Video"
                  >
                    <VideoIcon className="w-5 h-5 text-slate-400" />
                  </button>
                  <button 
                    onClick={() => setShowChatMediaModal(true)}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10"
                    title="Camera / URL"
                  >
                    <Camera className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              {chatSubTab === 'messages' ? (
                <>
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        {activeChatPartner ? `Chatting with ${(activeChatPartner as any).displayName || (activeChatPartner as any).name}` : 'Colony Community Chat'}
                      </span>
                    </div>
                    {activeChatPartner && (
                      <button 
                        onClick={() => setActiveChatPartner(null)}
                        className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold hover:text-indigo-300"
                      >
                        Back to ColonyChat
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                    {messages.map((msg) => (
                      <ChatMessage 
                        key={msg.id}
                        msg={msg}
                        user={user}
                        onLongPress={() => setLongPressedItem({ id: msg.id, type: 'message', authorUid: msg.authorUid, content: msg.content })}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {chatImage && (
                        <div className="relative inline-block">
                          <img src={chatImage} className="w-20 h-20 object-cover rounded-lg border border-white/20" alt="" />
                          <button onClick={() => setChatImage('')} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {chatVideo && (
                        <div className="relative inline-block">
                          <video src={chatVideo} className="w-20 h-20 object-cover rounded-lg border border-white/20" />
                          <button onClick={() => setChatVideo('')} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                      />
                      <button 
                        onClick={() => toggleMic('chat')}
                        className={cn(
                          "p-3 rounded-2xl transition-all shadow-lg",
                          isChatRecording ? "bg-red-600 animate-pulse shadow-red-600/30" : "bg-white/5 border border-white/10 hover:bg-white/10"
                        )}
                      >
                        <Mic className={cn("w-6 h-6", isChatRecording ? "text-white" : "text-slate-400")} />
                      </button>
                      <button 
                        onClick={handleSendMessage}
                        className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30"
                      >
                        <Send className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {chatSubTab === 'contacts' ? (
                    <>
                      <button 
                        onClick={() => setShowAddContactModal(true)}
                        className="w-full bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-center gap-3 text-indigo-400 hover:bg-indigo-600/20 transition-all mb-4"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="font-bold">Add New Contact</span>
                      </button>

                      {contacts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 py-20">
                          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                            <Users className="w-8 h-8 opacity-20" />
                          </div>
                          <p>No contacts saved yet.</p>
                        </div>
                      ) : (
                        contacts.map((c) => (
                          <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => {
                              setActiveChatPartner(c);
                              setChatSubTab('messages');
                            }}>
                              <div className="w-12 h-12 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-bold text-xl">
                                {c.name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-lg leading-tight">{c.name}</h4>
                                <p className="text-sm text-slate-400 font-mono">{c.phoneNumber}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a 
                                href={`tel:${c.phoneNumber}`}
                                className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all"
                                title="Call"
                              >
                                <Phone className="w-5 h-5" />
                              </a>
                              <button 
                                onClick={() => {
                                  setActiveChatPartner(c);
                                  setChatSubTab('messages');
                                }}
                                className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500/30 transition-all"
                                title="Chat"
                              >
                                <MessageCircle className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    allUsers.filter(u => u.uid !== user?.uid).map((u) => (
                      <div key={u.uid} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/10 transition-all">
                        <div className="flex items-center gap-4">
                          <img 
                            src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                            className="w-12 h-12 rounded-full border border-white/10 object-cover"
                            alt=""
                          />
                          <div className="cursor-pointer" onClick={() => {
                            setActiveChatPartner(u);
                            setChatSubTab('messages');
                          }}>
                            <h4 className="font-bold text-white">{u.displayName}</h4>
                            <p className="text-xs text-slate-500">{u.blockName ? `${u.blockName} - ${u.houseNumber}` : 'Colony Resident'}</p>
                            {u.phoneNumber && <p className="text-xs text-indigo-400 mt-1 font-mono">{u.phoneNumber}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={async () => {
                              try {
                                await addDoc(collection(db, 'users', user.uid, 'contacts'), {
                                  name: u.displayName,
                                  phoneNumber: u.phoneNumber || '',
                                  uid: u.uid,
                                  createdAt: serverTimestamp(),
                                });
                                setChatSubTab('contacts');
                              } catch (err) {
                                handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/contacts`);
                              }
                            }}
                            className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 transition-all"
                            title="Save to Contacts"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                          {u.phoneNumber && (
                            <a 
                              href={`tel:${u.phoneNumber}`}
                              className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all"
                              title="Call"
                            >
                              <Phone className="w-5 h-5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col relative"
            >
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Colony Map</h2>
                  <p className="text-slate-400 text-sm">Explore your neighborhood and local spots.</p>
                </div>
                {!emergencyActive && (
                  <button 
                    onClick={() => setShowEmergencyModal(true)}
                    className="flex flex-col items-center gap-1 p-3 bg-red-600/20 border border-red-500/30 rounded-2xl text-red-500 hover:bg-red-600/30 transition-all shadow-lg shadow-red-600/20"
                  >
                    <ShieldAlert className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">SOS</span>
                  </button>
                )}
              </div>
              
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                  <button 
                    onClick={() => window.open(`https://www.google.com/maps?q=${DEFAULT_CENTER[0]},${DEFAULT_CENTER[1]}`, '_blank')}
                    className="p-3 bg-slate-950/50 backdrop-blur-md border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all shadow-xl"
                    title="Open in Google Maps"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                  
                  {/* Uber Integration */}
                  <button 
                    onClick={() => window.open('https://m.uber.com/ul/?action=setPickup&pickup=my_location', '_blank')}
                    className="p-3 bg-black border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all shadow-xl flex items-center justify-center"
                    title="Book Uber"
                  >
                    <div className="w-5 h-5 flex items-center justify-center font-black text-[10px] border border-white rounded-sm">U</div>
                  </button>

                  {/* Rapido Integration */}
                  <button 
                    onClick={() => window.open('https://www.rapido.bike/', '_blank')}
                    className="p-3 bg-yellow-400 border border-yellow-500 rounded-2xl text-black hover:bg-yellow-300 transition-all shadow-xl flex items-center justify-center"
                    title="Book Rapido"
                  >
                    <div className="w-5 h-5 flex items-center justify-center font-black text-[10px]">R</div>
                  </button>

                  <button 
                    onClick={isTracking ? stopTracking : startTracking}
                    className={cn(
                      "p-3 backdrop-blur-md border rounded-2xl transition-all",
                      isTracking 
                        ? "bg-emerald-600/50 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-600/20" 
                        : "bg-slate-950/50 border-white/10 text-white hover:bg-white/20"
                    )}
                    title={isTracking ? "Stop Live Tracking" : "Start Live Tracking"}
                  >
                    <Navigation className={cn("w-5 h-5", isTracking && "animate-pulse")} />
                  </button>
                </div>
                <MapContainer 
                  center={DEFAULT_CENTER} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapController center={emergencyActive && safeZones.length > 0 ? [safeZones[0].lat, safeZones[0].lng] : (isTracking && userLocation ? userLocation : DEFAULT_CENTER)} />
                  
                  {userLocation && (
                    <Marker position={userLocation}>
                      <Popup>
                        <div className="p-2 text-slate-900">
                          <h4 className="font-bold">You are here</h4>
                          <p className="text-xs">Live Location Active</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {safeZones.map(zone => (
                    <Marker key={zone.id} position={[zone.lat, zone.lng]}>
                      <Popup>
                        <div className="p-2 text-slate-900">
                          <h4 className="font-bold">{zone.name}</h4>
                          <p className="text-xs">{zone.type}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>

                {emergencyActive && (
                  <div className="absolute inset-0 bg-red-600/10 animate-pulse pointer-events-none z-[1000]" />
                )}

                {emergencyActive && (
                  <div className="absolute bottom-6 left-6 right-6 z-[1001] space-y-4">
                    <div className="bg-red-600 p-6 rounded-3xl shadow-2xl shadow-red-600/40 text-center space-y-2">
                      <AlertTriangle className="w-12 h-12 mx-auto animate-bounce" />
                      <h3 className="text-2xl font-bold">Emergency Active</h3>
                      <p className="text-red-100">Help is being notified. Nearby safe zones are highlighted.</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 px-2">Nearby Safe Zones</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {safeZones.map(zone => (
                          <div key={zone.id} className="bg-slate-950/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center">
                                {zone.type === 'police' ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <LifeBuoy className="w-5 h-5 text-emerald-400" />}
                              </div>
                              <div>
                                <div className="font-bold">{zone.name}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">{zone.type} • 0.5 miles</div>
                              </div>
                            </div>
                            <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10">
                              <Navigation className="w-5 h-5 text-indigo-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={handleCancelEmergency}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-slate-400 hover:bg-white/10"
                    >
                      Cancel Emergency
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full overflow-y-auto p-6 space-y-8"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <img 
                    src={profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-32 h-32 rounded-full border-4 border-indigo-600 p-1 bg-slate-900 object-cover" 
                    alt="Profile" 
                  />
                  <div className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 border-4 border-slate-950 rounded-full" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">{profile?.displayName || user.displayName}</h2>
                  <p className="text-slate-400">{user.email}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl text-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">House</div>
                    <div className="font-bold">{profile?.houseNumber || 'N/A'}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl text-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Floor</div>
                    <div className="font-bold">{profile?.floorNumber || 'N/A'}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl text-center col-span-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Block</div>
                    <div className="font-bold">{profile?.blockName || 'N/A'}</div>
                  </div>
                </div>

                <p className="text-slate-300 max-w-xs italic">
                  "{profile?.bio || 'No bio yet. Community member since 2026.'}"
                </p>
                <button 
                  onClick={() => {
                    setEditName(profile?.displayName || user.displayName || '');
                    setEditBio(profile?.bio || '');
                    setEditHouse(profile?.houseNumber || '');
                    setEditFloor(profile?.floorNumber || '');
                    setEditBlock(profile?.blockName || '');
                    setEditPhone(profile?.phoneNumber || '');
                    setEditParentPhone(profile?.parentPhoneNumber || '');
                    setEditSecurityPassword(profile?.securityPassword || '');
                    setEditPhoto(profile?.photoURL || user.photoURL || '');
                    setShowEditProfileModal(true);
                  }}
                  className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10"
                >
                  Edit Profile
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-red-500" />
                  <h3 className="text-xl font-bold">Emergency Helplines</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <a 
                    href="tel:112"
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-red-600/10 border border-red-500/20 rounded-2xl hover:bg-red-600/20 transition-all"
                  >
                    <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-red-500 uppercase">ERSS / Fire & Ambulance</div>
                      <div className="text-sm font-bold">112</div>
                    </div>
                  </a>
                  <a 
                    href="tel:100"
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl hover:bg-blue-600/20 transition-all"
                  >
                    <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-blue-500 uppercase">Police Helpline</div>
                      <div className="text-sm font-bold">100</div>
                    </div>
                  </a>
                  <a 
                    href="tel:181"
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-pink-600/10 border border-pink-500/20 rounded-2xl hover:bg-pink-600/20 transition-all"
                  >
                    <div className="w-10 h-10 bg-pink-600/20 rounded-full flex items-center justify-center">
                      <Heart className="w-5 h-5 text-pink-500" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-pink-500 uppercase">Women Helpline</div>
                      <div className="text-sm font-bold">181</div>
                    </div>
                  </a>
                  <a 
                    href="tel:1098"
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl hover:bg-emerald-600/20 transition-all"
                  >
                    <div className="w-10 h-10 bg-emerald-600/20 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-emerald-500 uppercase">Child Helpline</div>
                      <div className="text-sm font-bold">1098</div>
                    </div>
                  </a>
                  <a 
                    href="tel:14490"
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-purple-600/10 border border-purple-500/20 rounded-2xl hover:bg-purple-600/20 transition-all"
                  >
                    <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-purple-500 uppercase">NCW (Violence-Affected)</div>
                      <div className="text-sm font-bold">14490</div>
                    </div>
                  </a>
                  <a 
                    href="tel:08125078218"
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-orange-600/10 border border-orange-500/20 rounded-2xl hover:bg-orange-600/20 transition-all"
                  >
                    <div className="w-10 h-10 bg-orange-600/20 rounded-full flex items-center justify-center">
                      <Ambulance className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-orange-500 uppercase">24/7 Ambulance</div>
                      <div className="text-xs font-bold leading-tight">08125078218</div>
                    </div>
                  </a>
                </div>
                <div className="p-3 bg-red-600/5 border border-red-500/10 rounded-xl text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Fire & Ambulance (ERSS)</p>
                  <p className="text-lg font-bold text-red-500">Call 112</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <QrCode className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-bold">ColonyConnect Mobile</h3>
                </div>
                <div className="bg-white p-4 rounded-2xl flex justify-center shadow-inner">
                  <QRCode 
                    value={window.location.origin} 
                    size={180}
                    fgColor="#0f172a"
                    level="H"
                  />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-sm text-slate-300 font-medium">Scan to open on your phone</p>
                  <p className="text-xs text-slate-500">Access your community features, SOS alerts, and colony chat anywhere.</p>
                </div>
                
                <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'ColonyConnect',
                        text: 'Join our colony on ColonyConnect!',
                        url: window.location.origin,
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.origin);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-xl font-medium hover:bg-indigo-600/30 transition-colors"
                >
                  {copySuccess ? 'Link Copied!' : 'Share App Link'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- Navigation --- */}
      <nav className="p-4 bg-slate-900/80 backdrop-blur-xl border-t border-white/10 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home />} label="Home" />
          <NavButton active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} icon={<Activity />} label="Feed" />
          <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare />} label="Chat" />
          <NavButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<MapIcon />} label="Map" />
          <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon />} label="Profile" />
        </div>
      </nav>

      {/* --- Post Modal --- */}
      <AnimatePresence>
        {showPostModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">New Post</h3>
                <button onClick={() => setShowPostModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 pr-12 focus:outline-none focus:border-indigo-500 resize-none"
                />
                <button 
                  onClick={() => toggleMic('feed')}
                  className={cn(
                    "absolute right-4 top-4 p-2 rounded-xl transition-all",
                    isFeedRecording ? "bg-red-600 animate-pulse text-white" : "bg-white/5 text-slate-500 hover:bg-white/10"
                  )}
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Image</label>
                  <div className="flex flex-col gap-2">
                    {newPostImage && (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10">
                        <img src={newPostImage} className="w-full h-full object-cover" alt="Preview" />
                        <button 
                          onClick={() => setNewPostImage('')}
                          className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white shadow-lg"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <input
                      value={newPostImage.startsWith('data:') ? 'File selected' : newPostImage}
                      onChange={(e) => setNewPostImage(e.target.value)}
                      placeholder="URL or Upload..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs bg-indigo-600/20 text-indigo-400 py-1 rounded-lg border border-indigo-500/30"
                    >
                      Upload Photo
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e, 'post', 'photo')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Video</label>
                  <div className="flex flex-col gap-2">
                    {newPostVideo && (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black">
                        <video src={newPostVideo} className="w-full h-full object-contain" controls />
                        <button 
                          onClick={() => setNewPostVideo('')}
                          className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white shadow-lg z-10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <input
                      value={newPostVideo.startsWith('data:') ? 'File selected' : newPostVideo}
                      onChange={(e) => setNewPostVideo(e.target.value)}
                      placeholder="URL or Upload..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
                    />
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'video/*';
                        input.onchange = (e: any) => handleFileSelect(e, 'post', 'video');
                        input.click();
                      }}
                      className="text-xs bg-pink-600/20 text-pink-400 py-1 rounded-lg border border-pink-500/30"
                    >
                      Upload Video
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCreatePost}
                disabled={!newPostContent.trim() || isUploading}
                className="w-full py-4 bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/30"
              >
                {isUploading ? 'Processing...' : 'Post to Feed'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Long Press Action Modal --- */}
      <AnimatePresence>
        {longPressedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold uppercase tracking-widest text-slate-400">Actions</h3>
                <button onClick={() => setLongPressedItem(null)} className="p-1 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid gap-3">
                <button 
                  onClick={() => handleShareItem(longPressedItem.content)}
                  className="flex items-center justify-center gap-3 w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-5 h-5 text-indigo-400" />
                  Share Content
                </button>

                {longPressedItem.authorUid === user.uid && (
                  <button 
                    onClick={() => {
                      if (longPressedItem.type === 'post') handleDeletePost(longPressedItem.id);
                      else handleDeleteMessage(longPressedItem.id);
                      setLongPressedItem(null);
                    }}
                    className="flex items-center justify-center gap-3 w-full py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-bold hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete {longPressedItem.type === 'post' ? 'Post' : 'Message'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Emergency Modal --- */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-red-950/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-red-500/30 rounded-3xl p-8 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-600/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Emergency SOS</h3>
                <p className="text-slate-400">
                  This will notify local authorities and community safety leads of your current location.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={handleTriggerEmergency}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold text-lg shadow-lg shadow-red-600/30 transition-all"
                >
                  Confirm Emergency
                </button>
                <button 
                  onClick={() => setShowEmergencyModal(false)}
                  className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-slate-400 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Phone className="w-3 h-3" />
                <span>Direct line to emergency services will be opened</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Stop Emergency Modal --- */}
      <AnimatePresence>
        {showStopEmergencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Security Verification</h3>
                <p className="text-slate-400 text-sm">
                  Enter your Security PIN to stop the emergency alert.
                </p>
              </div>
              <div className="space-y-4">
                <input 
                  type="password"
                  value={stopEmergencyPassword}
                  onChange={(e) => setStopEmergencyPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-center text-2xl tracking-[1em] focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="••••"
                  maxLength={10}
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleConfirmStopEmergency}
                    className="py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold transition-all"
                  >
                    Verify
                  </button>
                  <button 
                    onClick={() => setShowStopEmergencyModal(false)}
                    className="py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-slate-400 hover:bg-white/10"
                  >
                    Back
                  </button>
                </div>
              </div>
              {!profile?.securityPassword && (
                <p className="text-[10px] text-slate-500 italic">
                  Tip: Default PIN is 1234. Change it in your profile settings.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Add Contact Modal --- */}
      <AnimatePresence>
        {showAddContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Add New Contact</h3>
                <button onClick={() => setShowAddContactModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Contact Name</label>
                  <input 
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                    placeholder="Enter name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone Number</label>
                  <input 
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
              </div>

              <button 
                onClick={handleAddContact}
                disabled={!newContactName.trim() || !newContactPhone.trim()}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold shadow-lg shadow-indigo-600/30 transition-all"
              >
                Save Contact
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEditProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Edit Profile</h3>
                <button onClick={() => setShowEditProfileModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col items-center space-y-4">
                <div className="relative group cursor-pointer" onClick={() => profileFileInputRef.current?.click()}>
                  <img 
                    src={editPhoto || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-24 h-24 rounded-full border-2 border-indigo-600 object-cover" 
                    alt="Edit Profile" 
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6" />
                  </div>
                  <input 
                    type="file" 
                    ref={profileFileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'profile', 'photo')}
                  />
                </div>
                <p className="text-xs text-slate-500">Click to change photo</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Full Name</label>
                  <input 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Bio</label>
                  <textarea 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 min-h-[80px]"
                    placeholder="Tell us about yourself"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone Number (for Chat Calls)</label>
                  <input 
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Parent's Phone Number (for SOS)</label>
                  <input 
                    value={editParentPhone}
                    onChange={(e) => setEditParentPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. +91 63016 20861"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Security PIN (to stop SOS)</label>
                  <input 
                    type="password"
                    value={editSecurityPassword}
                    onChange={(e) => setEditSecurityPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                    placeholder="Set a 4-digit PIN"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">House Number</label>
                    <input 
                      value={editHouse}
                      onChange={(e) => setEditHouse(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. 101"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Floor Number</label>
                    <input 
                      value={editFloor}
                      onChange={(e) => setEditFloor(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. 1st"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Block Name</label>
                  <input 
                    value={editBlock}
                    onChange={(e) => setEditBlock(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Block A"
                  />
                </div>
              </div>

              <button 
                onClick={handleUpdateProfile}
                disabled={isUploading}
                className="w-full py-4 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Save Profile'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Wallpaper Selector Modal --- */}
      <AnimatePresence>
        {showWallpaperModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Layers className="w-6 h-6 text-indigo-400" />
                  Choose Wallpaper
                </h3>
                <button onClick={() => setShowWallpaperModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: '3d-grid', name: '3D Grid', icon: <Zap className="w-5 h-5" /> },
                  { id: 'orbs', name: 'Floating Orbs', icon: <Sparkles className="w-5 h-5" /> },
                  { id: 'aurora', name: 'Aurora', icon: <Activity className="w-5 h-5" /> },
                  { id: 'nebula', name: 'Nebula', icon: <Globe className="w-5 h-5" /> },
                  { id: 'custom', name: 'Gallery', icon: <ImageIcon className="w-5 h-5" /> },
                  { id: 'minimal', name: 'Minimal', icon: <Layout className="w-5 h-5" /> },
                  { id: 'none', name: 'None', icon: <X className="w-5 h-5" /> },
                ].map(style => (
                  <button
                    key={style.id}
                    onClick={async () => {
                      if (style.id === 'custom') {
                        wallpaperFileInputRef.current?.click();
                      } else {
                        setWallpaperSettings(s => ({ ...s, wallpaperStyle: style.id, showThreeDWallpaper: style.id !== 'none' }));
                        setShowWallpaperModal(false);
                        
                        // Persist to Firestore
                        if (user) {
                          try {
                            await updateDoc(doc(db, 'users', user.uid), {
                              wallpaperStyle: style.id,
                              showThreeDWallpaper: style.id !== 'none'
                            });
                          } catch (error) {
                            console.error("Error saving wallpaper style to Firestore", error);
                          }
                        }
                      }
                    }}
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center",
                      wallpaperSettings.wallpaperStyle === style.id ? "bg-indigo-600/20 border-indigo-500" : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl", wallpaperSettings.wallpaperStyle === style.id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400")}>
                      {style.icon}
                    </div>
                    <span className="text-sm font-medium">{style.name}</span>
                  </button>
                ))}
              </div>
              
              <input 
                type="file" 
                ref={wallpaperFileInputRef} 
                onChange={handleWallpaperFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Chat Media Modal --- */}
      <AnimatePresence>
        {showChatMediaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Add Media</h3>
                <button onClick={() => setShowChatMediaModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex p-1 bg-white/5 rounded-xl">
                <button 
                  onClick={() => setTempMediaType('photo')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    tempMediaType === 'photo' ? "bg-indigo-600 text-white" : "text-slate-400"
                  )}
                >
                  Photo
                </button>
                <button 
                  onClick={() => setTempMediaType('video')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    tempMediaType === 'video' ? "bg-indigo-600 text-white" : "text-slate-400"
                  )}
                >
                  Video
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-400">Enter {tempMediaType} URL</label>
                <input
                  value={tempMediaUrl}
                  onChange={(e) => setTempMediaUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                />
                <div className="text-center py-2 text-slate-500 text-xs">OR</div>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = tempMediaType === 'photo' ? 'image/*' : 'video/*';
                    input.onchange = (e: any) => handleFileSelect(e, 'chat', tempMediaType);
                    input.click();
                  }}
                  className="w-full py-3 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Upload from Device
                </button>
              </div>

              <button
                onClick={() => {
                  if (tempMediaUrl) {
                    if (tempMediaType === 'photo') setChatImage(tempMediaUrl);
                    else setChatVideo(tempMediaUrl);
                    setTempMediaUrl('');
                    setShowChatMediaModal(false);
                  }
                }}
                className="w-full py-4 bg-indigo-600 rounded-2xl font-bold shadow-lg shadow-indigo-600/30"
              >
                Add to Message
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery Modal */}
      <AnimatePresence>
        {showGalleryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-bold">Your Gallery</h3>
                </div>
                <button 
                  onClick={() => setShowGalleryModal(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {gallery.length === 0 ? (
                  <div className="text-center py-20 space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                      <ImageIcon className="w-8 h-8 text-slate-700" />
                    </div>
                    <p className="text-slate-500">Your gallery is empty.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {gallery.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (galleryTarget === 'chat') {
                            if (item.type === 'image') setChatImage(item.url);
                            else setChatVideo(item.url);
                          } else if (galleryTarget === 'post') {
                            if (item.type === 'image') setNewPostImage(item.url);
                            else setNewPostVideo(item.url);
                          }
                          setShowGalleryModal(false);
                        }}
                        className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-indigo-500 transition-all relative group"
                      >
                        {item.type === 'image' ? (
                          <img src={item.url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                            <Video className="w-6 h-6 text-slate-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Plus className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        active ? "text-indigo-400 scale-110" : "text-slate-500 hover:text-slate-300"
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-indigo-400 rounded-full mt-1" />}
    </button>
  );
}

export default function App() {
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
