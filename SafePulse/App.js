import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, 
  FlatList, Platform, Dimensions, ScrollView, Switch, Image, Animated, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['[expo-av]: Expo AV has been deprecated']);
let MapView, Marker, Circle, Polyline;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  Polyline = Maps.Polyline;
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.209:8000';
const API_URL = `${BASE_URL}/analyze`;
const { width } = Dimensions.get('window');

const EmergencyContext = createContext();

const formatTime = (date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const EmergencyProvider = ({ children }) => {
  const [isEmergency, setIsEmergency] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertsHistory, setAlertsHistory] = useState([]);
  const [location, setLocation] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiAuto, setIsAiAuto] = useState(true);
  const eventIdRef = useRef(1000); // Monotonic counter for unique keys

  // Live Timeline State
  const [liveTimeline, setLiveTimeline] = useState([
    { id: 1, time: formatTime(new Date(Date.now() - 60000)), text: "System monitoring active", color: "#4A90E2" }
  ]);

  const addTimelineEvent = (text, color) => {
    eventIdRef.current += 1;
    const uniqueId = eventIdRef.current;
    setLiveTimeline(prev => [
      { id: uniqueId, time: formatTime(new Date()), text, color },
      ...prev
    ].slice(0, 10));
  };

  // Background Simulator for Live Activity
  useEffect(() => {
    if (isEmergency || !isAiAuto) return;
    
    const messages = [
      "Scanning crowd density in lobby...",
      "Audio decibel levels normal",
      "Network connection stable",
      "No anomalous movement detected",
      "Vision AI running background checks"
    ];

    const interval = setInterval(() => {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      addTimelineEvent(randomMsg, "#4A90E2");
    }, 8000);

    return () => clearInterval(interval);
  }, [isEmergency, isAiAuto]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setLocation(loc.coords);
    })();
  }, []);

  useEffect(() => {
    if (isEmergency && activeAlert) {
      Speech.speak(`Emergency detected. ${activeAlert.action}.`, { language: 'en', pitch: 1.1, rate: 0.95 });
    } else if (!isEmergency && alertsHistory.length > 0) {
      Speech.speak("System is now safe. All alerts have been resolved.", { language: 'en', pitch: 1.0, rate: 0.95 });
    }
  }, [isEmergency]);

  const triggerEmergency = async () => {
    setLoading(true);
    addTimelineEvent("Manual SOS Triggered. Connecting to Backend...", "#FFB800");

    const payload = {
      message: "people are running and shouting",
      crowd_density: 85,
      movement: "high",
      noise_level: 60,
      prev_crowd: 75,
      zone: "lobby"
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      
      setActiveAlert(result);
      setAlertsHistory([result, ...alertsHistory]);
      setIsEmergency(true);
      addTimelineEvent(`Critical Alert: ${result.type.toUpperCase()}`, "#FF2A55");
      addTimelineEvent(`AI Action: ${result.action}`, "#00E676");
    } catch (error) {
      const fallback = {
        type: "panic", severity: "critical", risk: 89, action: "evacuate and control crowd",
        assigned_team: "crowd_control_team", zone: "lobby", priority: "high",
        recommended_response_time: "immediate", prediction: "risk likely to increase",
        action_confidence: 0.44, explanation: "Fallback: Connection failed.",
        timestamp: new Date().toISOString()
      };
      setActiveAlert(fallback);
      setAlertsHistory([fallback, ...alertsHistory]);
      setIsEmergency(true);
      addTimelineEvent("Critical Alert: PANIC DETECTED (Fallback)", "#FF2A55");
    } finally {
      setLoading(false);
    }
  };

  const triggerVisionEmergency = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.5, base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setLoading(true);
      addTimelineEvent("Analyzing live camera feed via MobileNetV2...", "#FFB800");
      const payload = {
        image_base64: result.assets[0].base64,
        crowd_density: 85, movement: "high", noise_level: 60, prev_crowd: 75, zone: "lobby"
      };

      try {
        const response = await fetch(`${BASE_URL}/analyze/vision`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const resultData = await response.json();
        
        if (resultData.risk > 50) {
          setActiveAlert(resultData);
          setAlertsHistory([resultData, ...alertsHistory]);
          setIsEmergency(true);
          addTimelineEvent(`Vision Threat Detected: ${resultData.type.toUpperCase()}`, "#FF2A55");
        } else {
          Speech.speak(`Scan complete. Detected ${resultData.type}. System is safe.`, { language: 'en' });
          setIsEmergency(false);
          addTimelineEvent(`Vision clear. Detected: ${resultData.type}`, "#00E676");
        }
      } catch (error) {
        addTimelineEvent("Vision API Error", "#FF2A55");
      } finally {
        setLoading(false);
      }
    }
  };

  const startRecording = async () => {
    try {
      if (recording) { await recording.stopAndUnloadAsync(); setRecording(null); }
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRecording);
      setIsRecording(true);
      addTimelineEvent("Recording audio for Gemini 1.5 Analysis...", "#FFB800");
    } catch (err) { }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(null); setIsRecording(false); setLoading(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        addTimelineEvent("Audio uploaded. Awaiting Gemini response...", "#FFB800");
        const payload = { audio_base64: base64data, crowd_density: 85, movement: "high", noise_level: 90, zone: "lobby" };
        
        const apiResponse = await fetch(`${BASE_URL}/analyze/audio`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const resultData = await apiResponse.json();
        
        if (resultData.risk > 50) {
          setActiveAlert(resultData);
          setAlertsHistory([resultData, ...alertsHistory]);
          setIsEmergency(true);
          addTimelineEvent(`Audio Threat: ${resultData.type.toUpperCase()}`, "#FF2A55");
        } else {
          Speech.speak(`Analysis complete. Detected ${resultData.type}.`, { language: 'en' });
          setIsEmergency(false);
          addTimelineEvent(`Audio safe. Detected: ${resultData.type}`, "#00E676");
        }
        setLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      setLoading(false);
    }
  };

  const resolveEmergency = () => {
    setIsEmergency(false);
    setActiveAlert(null);
    addTimelineEvent("All systems reset to normal by operator", "#00E676");
  };

  return (
    <EmergencyContext.Provider value={{ isEmergency, loading, isRecording, activeAlert, alertsHistory, triggerEmergency, triggerVisionEmergency, startRecording, stopRecording, resolveEmergency, location, isAiAuto, setIsAiAuto, liveTimeline }}>
      {children}
    </EmergencyContext.Provider>
  );
};

// ==========================================
// HOME SCREEN
// ==========================================
function HomeScreen() {
  const { isEmergency, loading, isRecording, activeAlert, triggerEmergency, triggerVisionEmergency, startRecording, stopRecording, resolveEmergency, alertsHistory, isAiAuto, setIsAiAuto, liveTimeline } = useContext(EmergencyContext);

  return (
    <SafeAreaView style={styles.container}>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER / AI TOGGLE */}
        <View style={styles.aiToggleCard}>
          <View>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Image source={require('./assets/icon.png')} style={{ width: 24, height: 24, borderRadius: 6, marginRight: 8, borderWidth: 1, borderColor: '#00F0FF' }} />
              <Text style={styles.aiToggleTitle}>AI Auto Response</Text>
            </View>
            <Text style={styles.aiToggleSub}>{isAiAuto ? 'Automated monitoring active' : 'Manual mode active'}</Text>
          </View>
          <Switch
            trackColor={{ false: '#3E4B6B', true: '#00E676' }}
            thumbColor={'#ffffff'}
            ios_backgroundColor="#3E4B6B"
            onValueChange={() => setIsAiAuto(!isAiAuto)}
            value={isAiAuto}
          />
        </View>

        {/* SYSTEM STATUS */}
        <View style={[styles.statusCard, isEmergency && { borderColor: 'rgba(255, 42, 85, 0.4)' }]}>
          <Text style={styles.statusLabel}>S Y S T E M   S T A T U S</Text>
          <Text style={[styles.statusMain, isEmergency && { color: '#FF2A55' }]}>
            {isEmergency ? "CRITICAL" : "SAFE"}
          </Text>
          <Text style={styles.statusSub}>
            {isEmergency ? "Threat detected in premises" : "All systems operational"}
          </Text>
        </View>

        {/* DASHBOARD STATS */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#4A90E2' }]}>{isEmergency ? 1 : 0}</Text>
            <Text style={styles.statLabel}>ALERTS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#00E676' }]}>{isEmergency ? 3 : 12}</Text>
            <Text style={styles.statLabel}>RESPONDERS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: isEmergency ? '#FF2A55' : '#00E676' }]}>
              {activeAlert ? activeAlert.risk : 12}%
            </Text>
            <Text style={styles.statLabel}>RISK</Text>
          </View>
        </View>

        {/* LIVE STATUS TIMELINE */}
        <Text style={styles.sectionTitle}>L I V E   S T A T U S</Text>
        <View style={styles.timelineContainer}>
          {liveTimeline.map((item, index) => (
            <View key={item.id} style={styles.timelineItem}>
              {/* Vertical line connecting dots */}
              {index !== liveTimeline.length - 1 && <View style={styles.timelineLine} />}
              <View style={[styles.timelineDot, { backgroundColor: item.color }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTime}>{item.time}</Text>
                <Text style={styles.timelineText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* BOTTOM ACTION BUTTONS */}
      <View style={styles.bottomBar}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.circleBtn} onPress={triggerVisionEmergency} disabled={loading}>
            <Ionicons name="camera" size={24} color="#A0AABF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.circleBtn, isRecording && { backgroundColor: 'rgba(255, 42, 85, 0.2)', borderColor: '#FF2A55' }]} onPressIn={startRecording} onPressOut={stopRecording} disabled={loading}>
            <Ionicons name={isRecording ? "radio" : "mic"} size={24} color={isRecording ? "#FF2A55" : "#A0AABF"} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.sosWrapper, isEmergency && { shadowColor: '#00E676' }]} 
          onPress={isEmergency ? resolveEmergency : triggerEmergency} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <LinearGradient
              colors={isEmergency ? ['#00E676', '#00B359'] : ['#FF4444', '#D32F2F']}
              style={styles.sosGradient}
            >
              <Ionicons name={isEmergency ? "checkmark" : "warning"} size={28} color="#FFF" />
              <Text style={styles.sosText}>{isEmergency ? "RESOLVE" : "SOS"}</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Maps zone names to compass bearing so danger is placed in a realistic direction
const ZONE_BEARINGS = {
  lobby: 45, entrance: 315, corridor: 0, cafeteria: 135,
  parking: 225, stairwell: 90, rooftop: 180, default: 60,
};

// Offset a coordinate by distanceMeters in a compass bearing direction
function moveCoord(lat, lng, bearingDeg, distanceMeters) {
  const R = 6371000;
  const d = distanceMeters / R;
  const b = (bearingDeg * Math.PI) / 180;
  const f1 = (lat * Math.PI) / 180;
  const l1 = (lng * Math.PI) / 180;
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
  return { latitude: (f2 * 180) / Math.PI, longitude: (l2 * 180) / Math.PI };
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyAwmkirdkRGMYbe4824qwvRPyTutXAAU9U';

// Decode Google's encoded polyline format into lat/lng array
function decodePolyline(encoded) {
  let index = 0, lat = 0, lng = 0;
  const result = [];
  while (index < encoded.length) {
    let shift = 0, result_ = 0, b;
    do { b = encoded.charCodeAt(index++) - 63; result_ |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result_ & 1) ? ~(result_ >> 1) : (result_ >> 1);
    shift = 0; result_ = 0;
    do { b = encoded.charCodeAt(index++) - 63; result_ |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result_ & 1) ? ~(result_ >> 1) : (result_ >> 1);
    result.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return result;
}

// ==========================================
// MAP SCREEN
// ==========================================
function MapScreen() {
  const { isEmergency, location, activeAlert } = useContext(EmergencyContext);
  const mapRef    = useRef(null);
  const [roadRoute,    setRoadRoute]    = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapType,      setMapType]      = useState('standard');
  const [showLegend,   setShowLegend]   = useState(false);
  const [quoteIndex,   setQuoteIndex]   = useState(0);
  const quoteFade = useRef(new Animated.Value(1)).current;

  const MAP_QUOTES = [
    { text: "AI-Powered Safe Guardian",        sub: "Protecting lives with intelligence" },
    { text: "Real-Time Threat Detection",       sub: "Gemini AI scanning 24/7" },
    { text: "Smart Evacuation. Zero Panic.",    sub: "Road-safe routes, instantly" },
    { text: "Every Second Counts",              sub: "SafePulse responds before you ask" },
    { text: "Vision. Audio. Decision.",         sub: "Tri-modal AI at your service" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(quoteFade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setQuoteIndex(i => (i + 1) % MAP_QUOTES.length);
        Animated.timing(quoteFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.centerContent}>
        <Ionicons name="map-outline" size={80} color="#555" />
      </View>
    );
  }

  const zoneName       = activeAlert?.zone?.toLowerCase() || 'default';
  const bearing        = ZONE_BEARINGS[zoneName] ?? ZONE_BEARINGS.default;
  const dangerZone     = location ? moveCoord(location.latitude, location.longitude, bearing, 350) : { latitude: 37.78895, longitude: -122.4324 };
  const safeDestination = location ? moveCoord(location.latitude, location.longitude, (bearing + 180) % 360, 500) : null;

  const getFallbackRoute = () => {
    if (!location) return [];
    const dLat = dangerZone.latitude - location.latitude;
    const dLng = dangerZone.longitude - location.longitude;
    return [
      { latitude: location.latitude,                         longitude: location.longitude },
      { latitude: location.latitude - dLat * 0.4 + 0.0004,  longitude: location.longitude - dLng * 0.4 - 0.0003 },
      { latitude: location.latitude - dLat * 0.85,          longitude: location.longitude - dLng * 0.85 + 0.0004 },
      { latitude: location.latitude - dLat * 1.4,           longitude: location.longitude - dLng * 1.4 },
    ];
  };

  const fetchRoadRoute = async (origin, dest) => {
    setRouteLoading(true);
    try {
      const url  = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&mode=walking&key=${GOOGLE_MAPS_API_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.routes.length > 0) {
        setRoadRoute(decodePolyline(data.routes[0].overview_polyline.points));
      } else { setRoadRoute(getFallbackRoute()); }
    } catch { setRoadRoute(getFallbackRoute()); }
    finally  { setRouteLoading(false); }
  };

  useEffect(() => {
    if (isEmergency && location && safeDestination) {
      fetchRoadRoute({ latitude: location.latitude, longitude: location.longitude }, safeDestination);
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [{ latitude: location.latitude, longitude: location.longitude }, dangerZone, safeDestination],
          { edgePadding: { top: 160, right: 60, bottom: 220, left: 60 }, animated: true }
        );
      }, 600);
    } else if (!isEmergency) { setRoadRoute([]); }
  }, [isEmergency]);

  const activeRoute  = roadRoute.length > 0 ? roadRoute : getFallbackRoute();
  const safeEndpoint = safeDestination ?? (activeRoute[activeRoute.length - 1] || null);

  const initialRegion = location ? {
    latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.018, longitudeDelta: 0.015,
  } : { latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.015, longitudeDelta: 0.0121 };

  const reCenter = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude, longitude: location.longitude,
        latitudeDelta: 0.012, longitudeDelta: 0.01,
      }, 800);
    }
  };

  const zoomToEmergency = () => {
    if (!isEmergency || !location) return;
    mapRef.current?.fitToCoordinates(
      [{ latitude: location.latitude, longitude: location.longitude }, dangerZone, ...(safeEndpoint ? [safeEndpoint] : [])],
      { edgePadding: { top: 160, right: 60, bottom: 220, left: 60 }, animated: true }
    );
  };

  const coordText = location
    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
    : 'Acquiring GPS...';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}   // We have our own recenter btn
        showsCompass={true}
        showsScale={true}
        mapType={mapType}
        userInterfaceStyle="dark"
        customMapStyle={mapType === 'standard' ? mapDarkStyle : []}
      >
        {isEmergency && (
          <>
            <Circle center={dangerZone} radius={300} strokeColor="rgba(255,42,85,0.2)" fillColor="rgba(255,42,85,0.05)" strokeWidth={1} />
            <Circle center={dangerZone} radius={180} strokeColor="rgba(255,42,85,0.8)" fillColor="rgba(255,42,85,0.2)" strokeWidth={2} />
            <Circle center={dangerZone} radius={55}  strokeColor="rgba(255,42,85,1)"   fillColor="rgba(255,42,85,0.5)" />
            <Marker coordinate={dangerZone} title={`⚠️ ${activeAlert?.zone?.toUpperCase() ?? 'DANGER ZONE'}`} description={`Threat: ${activeAlert?.type}`}>
              <View style={styles.dangerMarker}><Text style={styles.dangerMarkerText}>⚠️</Text></View>
            </Marker>
            {activeRoute.length > 0 && (
              <Polyline coordinates={activeRoute} strokeColor="#00E676" strokeWidth={roadRoute.length > 0 ? 5 : 4} lineDashPattern={roadRoute.length > 0 ? undefined : [14, 8]} />
            )}
            {safeEndpoint && (
              <Marker coordinate={safeEndpoint} title="✅ Safe Assembly Point">
                <View style={styles.safeMarker}><Ionicons name="shield-checkmark" size={28} color="#00E676" /></View>
              </Marker>
            )}
          </>
        )}
      </MapView>

      {/* ── TOP HEADER BAR ─────────────────────────────── */}
      <SafeAreaView style={styles.mapHeaderSafe} pointerEvents="box-none">
        <View style={styles.mapHeader}>
          <View style={styles.mapHeaderLeft}>
            <View style={[styles.mapStatusDot, { backgroundColor: isEmergency ? '#FF2A55' : '#00E676' }]} />
            <View>
              <Text style={styles.mapHeaderTitle}>{isEmergency ? 'EMERGENCY ACTIVE' : 'MONITORING ACTIVE'}</Text>
              <Text style={styles.mapHeaderCoord}>{coordText}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.mapSatBtn, mapType === 'satellite' && { backgroundColor: 'rgba(74,144,226,0.25)', borderColor: '#4A90E2' }]}
            onPress={() => setMapType(t => t === 'standard' ? 'satellite' : 'standard')}
          >
            <Ionicons name="layers" size={16} color={mapType === 'satellite' ? '#4A90E2' : '#A0AABF'} />
            <Text style={[styles.mapSatBtnText, mapType === 'satellite' && { color: '#4A90E2' }]}>
              {mapType === 'satellite' ? 'HYBRID' : 'SAT'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── RIGHT SIDE CONTROLS ────────────────────────── */}
      <View style={styles.mapRightControls}>
        {/* Re-center */}
        <TouchableOpacity style={styles.mapCtrlBtn} onPress={reCenter}>
          <Ionicons name="locate" size={20} color="#4A90E2" />
        </TouchableOpacity>

        {/* Zoom to emergency */}
        {isEmergency && (
          <TouchableOpacity style={styles.mapCtrlBtn} onPress={zoomToEmergency}>
            <Ionicons name="warning" size={20} color="#FF2A55" />
          </TouchableOpacity>
        )}

        {/* Legend toggle */}
        <TouchableOpacity style={styles.mapCtrlBtn} onPress={() => setShowLegend(v => !v)}>
          <Ionicons name="list" size={20} color="#A0AABF" />
        </TouchableOpacity>

        {/* Emergency call 112 */}
        <TouchableOpacity
          style={[styles.mapCtrlBtn, { backgroundColor: 'rgba(255,42,85,0.15)', borderColor: '#FF2A55' }]}
          onPress={() => Linking.openURL('tel:112')}
        >
          <Ionicons name="call" size={18} color="#FF2A55" />
        </TouchableOpacity>
      </View>

      {/* ── LEGEND POPUP ───────────────────────────────── */}
      {showLegend && (
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>MAP LEGEND</Text>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#FF2A55' }]} /><Text style={styles.legendText}>Danger Zone</Text></View>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#00E676' }]} /><Text style={styles.legendText}>Safe Assembly Point</Text></View>
          <View style={styles.legendRow}><View style={[styles.legendLine, { backgroundColor: '#00E676' }]} /><Text style={styles.legendText}>Evacuation Route</Text></View>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#4A90E2' }]} /><Text style={styles.legendText}>Your Location</Text></View>
        </View>
      )}

      {/* ── QUOTE CARD (replaces route loading badge) ─── */}
      <Animated.View style={[styles.mapQuoteCard, { opacity: quoteFade }]} pointerEvents="none">
        <LinearGradient
          colors={isEmergency ? ['rgba(255,42,85,0.12)', 'rgba(11,15,25,0.0)'] : ['rgba(0,240,255,0.10)', 'rgba(11,15,25,0.0)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <Ionicons
          name={isEmergency ? 'warning' : 'shield-checkmark'}
          size={16}
          color={isEmergency ? '#FF2A55' : '#00F0FF'}
          style={{ marginRight: 8 }}
        />
        <View>
          <Text style={[styles.mapQuoteText, isEmergency && { color: '#FF2A55' }]}>
            {MAP_QUOTES[quoteIndex].text}
          </Text>
          <Text style={styles.mapQuoteSub}>{MAP_QUOTES[quoteIndex].sub}</Text>
        </View>
      </Animated.View>

      {/* ── BOTTOM INFO PANEL ──────────────────────────── */}
      <View style={styles.mapBottomPanel}>
        {isEmergency && activeAlert ? (
          <>
            <View style={styles.mapBottomRow}>
              <View style={styles.mapBottomStat}>
                <Ionicons name="location" size={14} color="#FF2A55" />
                <Text style={styles.mapBottomStatLabel}>ZONE</Text>
                <Text style={[styles.mapBottomStatValue, { color: '#FF2A55' }]}>{activeAlert.zone?.toUpperCase()}</Text>
              </View>
              <View style={styles.mapBottomDivider} />
              <View style={styles.mapBottomStat}>
                <Ionicons name="pulse" size={14} color="#FF5E00" />
                <Text style={styles.mapBottomStatLabel}>RISK</Text>
                <Text style={[styles.mapBottomStatValue, { color: '#FF5E00' }]}>{activeAlert.risk}%</Text>
              </View>
              <View style={styles.mapBottomDivider} />
              <View style={styles.mapBottomStat}>
                <Ionicons name="navigate" size={14} color="#00E676" />
                <Text style={styles.mapBottomStatLabel}>ROUTE</Text>
                <Text style={[styles.mapBottomStatValue, { color: '#00E676' }]}>{roadRoute.length > 0 ? 'LIVE' : 'GEO'}</Text>
              </View>
              <View style={styles.mapBottomDivider} />
              <View style={styles.mapBottomStat}>
                <Ionicons name="people" size={14} color="#4A90E2" />
                <Text style={styles.mapBottomStatLabel}>TYPE</Text>
                <Text style={[styles.mapBottomStatValue, { color: '#4A90E2' }]}>{activeAlert.type?.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.mapBottomActionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapEvacLabel}>⚠️  EVACUATION ROUTE ACTIVE</Text>
                <Text style={styles.mapEvacSub}>Follow the green path to safe assembly point</Text>
              </View>
              <TouchableOpacity style={styles.mapCallBtn} onPress={() => Linking.openURL('tel:112')}>
                <Ionicons name="call" size={16} color="#FFF" />
                <Text style={styles.mapCallBtnText}>112</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.mapBottomRow}>
            <View style={styles.mapBottomStat}>
              <Ionicons name="shield-checkmark" size={14} color="#00E676" />
              <Text style={styles.mapBottomStatLabel}>STATUS</Text>
              <Text style={[styles.mapBottomStatValue, { color: '#00E676' }]}>SAFE</Text>
            </View>
            <View style={styles.mapBottomDivider} />
            <View style={styles.mapBottomStat}>
              <Ionicons name="radio" size={14} color="#4A90E2" />
              <Text style={styles.mapBottomStatLabel}>MONITORING</Text>
              <Text style={[styles.mapBottomStatValue, { color: '#4A90E2' }]}>LIVE</Text>
            </View>
            <View style={styles.mapBottomDivider} />
            <View style={styles.mapBottomStat}>
              <Ionicons name="locate" size={14} color="#A0AABF" />
              <Text style={styles.mapBottomStatLabel}>GPS</Text>
              <Text style={[styles.mapBottomStatValue, { color: '#A0AABF' }]}>{location ? 'LOCKED' : 'SEARCH'}</Text>
            </View>
            <View style={styles.mapBottomDivider} />
            <View style={styles.mapBottomStat}>
              <Ionicons name="layers" size={14} color="#A0AABF" />
              <Text style={styles.mapBottomStatLabel}>VIEW</Text>
              <Text style={[styles.mapBottomStatValue, { color: '#A0AABF' }]}>{mapType.toUpperCase()}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ==========================================
// ALERTS SCREEN
// ==========================================
function AlertsScreen() {
  const { alertsHistory } = useContext(EmergencyContext);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>System Alerts</Text></View>
      <FlatList
        data={alertsHistory}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.alertCard}>
            <Text style={styles.alertType}>{item.type.toUpperCase()}</Text>
            <Text style={styles.alertDetail}>Zone: {item.zone}</Text>
            <Text style={styles.alertAction}>Action: {item.action}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 20 }}
      />
    </SafeAreaView>
  );
}

// ==========================================
// AI INSIGHTS SCREEN
// ==========================================
function InsightsScreen() {
  const { activeAlert, isEmergency } = useContext(EmergencyContext);

  if (!isEmergency || !activeAlert) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Insights</Text>
          <Text style={styles.headerSub}>Real-time threat analysis</Text>
        </View>
        <View style={styles.centerContent}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="pulse-outline" size={56} color="#4A90E2" />
          </View>
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptyText}>AI is actively monitoring.{"\n"}Threat insights will appear here when{"\n"}an emergency is detected.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const confidencePct = Math.round((activeAlert.action_confidence || 0) * 100);
  const detectionPct = Math.round((activeAlert.confidence || 0.88) * 100);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Insights</Text>
        <Text style={styles.headerSub}>Live threat analysis</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Risk Score Circle */}
        <View style={styles.insightCard}>
          <Text style={styles.insightCardTitle}>REAL-TIME RISK SCORE</Text>
          <View style={styles.riskCircleWrap}>
            <LinearGradient colors={['#FF2A55', '#FF5E00']} style={styles.riskGradientRing}>
              <View style={styles.riskInnerCircle}>
                <Text style={styles.riskNumber}>{activeAlert.risk}</Text>
                <Text style={styles.riskUnit}>/ 100</Text>
              </View>
            </LinearGradient>
          </View>
          <Text style={styles.predictionText}>🔮 {activeAlert.prediction}</Text>
        </View>

        {/* Confidence Bars */}
        <View style={styles.insightCard}>
          <Text style={styles.insightCardTitle}>AI CONFIDENCE ANALYSIS</Text>
          <Text style={styles.confLabel}>Detection Confidence</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${detectionPct}%`, backgroundColor: '#4A90E2' }]} />
          </View>
          <Text style={styles.confValue}>{detectionPct}%</Text>

          <Text style={[styles.confLabel, { marginTop: 18 }]}>Action Confidence</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${confidencePct}%`, backgroundColor: '#00E676' }]} />
          </View>
          <Text style={styles.confValue}>{confidencePct}%</Text>
        </View>

        {/* Threat Metadata */}
        <View style={styles.insightCard}>
          <Text style={styles.insightCardTitle}>THREAT METADATA</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipLabel}>TYPE</Text>
              <Text style={styles.metaChipValue}>{activeAlert.type?.toUpperCase()}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipLabel}>SEVERITY</Text>
              <Text style={[styles.metaChipValue, { color: '#FF2A55' }]}>{activeAlert.severity?.toUpperCase()}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipLabel}>ZONE</Text>
              <Text style={styles.metaChipValue}>{activeAlert.zone?.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Root Cause Explanation */}
        <View style={[styles.insightCard, { borderColor: 'rgba(255, 42, 85, 0.35)' }]}>
          <Text style={styles.insightCardTitle}>ROOT CAUSE EXPLANATION</Text>
          <Text style={styles.explanationText}>{activeAlert.explanation}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// RESPONDERS SCREEN
// ==========================================
function RespondersScreen() {
  const { isEmergency, activeAlert } = useContext(EmergencyContext);

  // Real Indian Emergency Services with official contact numbers
  const teams = [
    {
      id: 1, name: "Police Control Room", role: "Crowd Control & Security",
      status: "24/7 Active", eta: "Live", icon: "shield", color: "#4A90E2",
      phone: "100", badge: "IND-POLICE", location: "District HQ",
    },
    {
      id: 2, name: "Ambulance Services", role: "Medical Emergency",
      status: "En Route", eta: "Immediate", icon: "medkit", color: "#00E676",
      phone: "102", badge: "IND-MEDICAL", location: "Nearest Hospital",
    },
    {
      id: 3, name: "Fire & Rescue", role: "Fire Response & Rescue",
      status: "Standby", eta: "4 mins", icon: "flame", color: "#FF5E00",
      phone: "101", badge: "IND-FIRE", location: "Fire Station",
    },
    {
      id: 4, name: "National Emergency", role: "Unified Emergency Helpline",
      status: "24/7 Active", eta: "Live", icon: "call", color: "#BD10E0",
      phone: "112", badge: "IND-EMERGENCY", location: "National Command",
    },
    {
      id: 5, name: "Disaster Management", role: "NDRF / Disaster Response",
      status: "On Call", eta: "8 mins", icon: "warning", color: "#FFB800",
      phone: "108", badge: "IND-NDRF", location: "State Control Room",
    },
  ];

  const isAssigned = (team) => isEmergency && activeAlert &&
    activeAlert.assigned_team?.toLowerCase().includes(team.role.split(' ')[0].toLowerCase());

  const handleCall = (phone) => {
    Linking.openURL(`tel:${phone}`).catch(() =>
      alert(`Cannot open dialer. Please call ${phone} manually.`)
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Response Teams</Text>
        <Text style={styles.headerSub}>{isEmergency ? `${teams.length} units alerted` : 'All units on standby'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Quick Dial Emergency Hotlines */}
        <Text style={styles.sectionTitle}>E M E R G E N C Y   H O T L I N E S</Text>
        <View style={styles.hotlineRow}>
          {[
            { label: 'Police', num: '100', color: '#4A90E2' },
            { label: 'Fire',   num: '101', color: '#FF5E00' },
            { label: 'Amb.',   num: '102', color: '#00E676' },
            { label: 'NDRF',   num: '108', color: '#FFB800' },
            { label: 'SOS',    num: '112', color: '#FF2A55' },
          ].map(h => (
            <TouchableOpacity key={h.num} style={[styles.hotlineChip, { borderColor: h.color }]} onPress={() => handleCall(h.num)}>
              <Text style={[styles.hotlineNum, { color: h.color }]}>{h.num}</Text>
              <Text style={styles.hotlineLabel}>{h.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isEmergency && activeAlert && (
          <LinearGradient
            colors={['rgba(0,240,255,0.15)', 'rgba(0,255,163,0.1)']}
            style={styles.aiDispatchBanner}
          >
            <Ionicons name="flash" size={18} color="#00F0FF" />
            <Text style={styles.aiDispatchText}>
              AI DISPATCHED: {activeAlert.assigned_team?.replace(/_/g,' ').toUpperCase()}
            </Text>
          </LinearGradient>
        )}

        {teams.map((team) => {
          const assigned = isAssigned(team);
          return (
            <View key={team.id} style={[styles.responderCard, assigned && { borderColor: team.color, backgroundColor: `${team.color}10` }]}>
              <View style={styles.responderCardHeader}>
                <View style={[styles.responderIconWrap, { backgroundColor: `${team.color}22` }]}>
                  <Ionicons name={team.icon} size={22} color={team.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.responderName}>{team.name}</Text>
                  <Text style={styles.responderRole}>{team.role}</Text>
                  <Text style={[styles.responderLocation]}>
                    <Ionicons name="location-outline" size={11} color="#6A7690" /> {team.location}
                  </Text>
                </View>
                {assigned && (
                  <View style={[styles.aiTag, { borderColor: team.color }]}>
                    <Text style={[styles.aiTagText, { color: team.color }]}>AI ASSIGNED</Text>
                  </View>
                )}
              </View>

              <View style={styles.responderFooter}>
                <View style={styles.responderStat}>
                  <Ionicons name="radio-outline" size={14} color="#6A7690" />
                  <Text style={[styles.responderStatText, assigned && { color: '#00E676' }]}>
                    {assigned ? 'Dispatched' : team.status}
                  </Text>
                </View>
                <View style={styles.responderStat}>
                  <Ionicons name="timer-outline" size={14} color="#6A7690" />
                  <Text style={styles.responderStatText}>ETA: {team.eta}</Text>
                </View>

                {/* LIVE CALL BUTTON */}
                <TouchableOpacity
                  style={[styles.callBtn, { backgroundColor: `${team.color}22`, borderColor: team.color }]}
                  onPress={() => handleCall(team.phone)}
                >
                  <Ionicons name="call" size={13} color={team.color} />
                  <Text style={[styles.callBtnText, { color: team.color }]}>{team.phone}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Comms Log */}
        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>C O M M S   L O G</Text>
        <View style={styles.commsCard}>
          {isEmergency ? (
            <>
              <View style={styles.commsRow}><Text style={styles.commsTime}>{formatTime(new Date())}</Text><Text style={styles.commsMsg}>All units: Threat confirmed in {activeAlert?.zone}. Respond immediately.</Text></View>
              <View style={styles.commsRow}><Text style={styles.commsTime}>{formatTime(new Date(Date.now()-30000))}</Text><Text style={styles.commsMsg}>AI dispatched {activeAlert?.assigned_team?.replace(/_/g,' ')} to zone.</Text></View>
              <View style={styles.commsRow}><Text style={styles.commsTime}>{formatTime(new Date(Date.now()-60000))}</Text><Text style={styles.commsMsg}>Emergency protocol triggered. Risk: {activeAlert?.risk}%</Text></View>
              <View style={styles.commsRow}><Text style={styles.commsTime}>{formatTime(new Date(Date.now()-90000))}</Text><Text style={styles.commsMsg}>Backup units on standby. Awaiting further orders.</Text></View>
            </>
          ) : (
            <>
              <View style={styles.commsRow}><Text style={styles.commsTime}>{formatTime(new Date())}</Text><Text style={styles.commsMsg}>All clear. Routine patrol active across all zones.</Text></View>
              <View style={styles.commsRow}><Text style={styles.commsTime}>{formatTime(new Date(Date.now()-120000))}</Text><Text style={styles.commsMsg}>Shift handover completed. 5 units live.</Text></View>
              <View style={styles.commsRow}><Text style={styles.commsTime}>{formatTime(new Date(Date.now()-240000))}</Text><Text style={styles.commsMsg}>MedUnit 4 re-stocked and ready for deployment.</Text></View>
            </>
          )}
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#4A90E2" />
          <Text style={styles.infoBannerText}>
            All numbers are official Government of India emergency services. Tap any number to call instantly.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// SPLASH SCREEN
// ==========================================
function SplashScreen({ onFinish }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade + scale in
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start();

    // Pulse loop on logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();

    // Fade out and call onFinish after 2.8s
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => onFinish());
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[splashStyles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#050810', '#0B0F19', '#0D1525']}
        style={StyleSheet.absoluteFill}
      />

      {/* Glowing ring behind logo */}
      <Animated.View style={[splashStyles.glowRing, { transform: [{ scale: pulseAnim }] }]} />

      {/* Logo */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <Image
          source={require('./assets/icon.png')}
          style={splashStyles.logo}
        />
      </Animated.View>

      {/* App Name */}
      <Animated.Text style={[splashStyles.appName, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        SafePulse
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[splashStyles.tagline, { opacity: fadeAnim }]}>
        AI-Powered Emergency Response
      </Animated.Text>

      {/* Thin loading bar at bottom */}
      <View style={splashStyles.loadingBarBg}>
        <Animated.View style={[splashStyles.loadingBarFill, {
          // Animate width via scaleX from 0→1 over 2.4s
        }]} />
      </View>

      {/* Powered-by line */}
      <Text style={splashStyles.poweredBy}>Powered by Google Gemini • MobileNetV2 • DistilBERT</Text>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0F19',
    zIndex: 999,
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    backgroundColor: 'rgba(0, 240, 255, 0.04)',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  logo: {
    width: 130,
    height: 130,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.8,
    shadowRadius: 25,
  },
  appName: {
    marginTop: 28,
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  tagline: {
    marginTop: 10,
    fontSize: 14,
    color: '#4A90E2',
    letterSpacing: 1.5,
    fontWeight: '500',
  },
  loadingBarBg: {
    position: 'absolute',
    bottom: 80,
    width: 180,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#1E2540',
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: 2,
    width: '70%',
    borderRadius: 1,
    backgroundColor: '#00F0FF',
  },
  poweredBy: {
    position: 'absolute',
    bottom: 50,
    fontSize: 10,
    color: '#3A4560',
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

// ==========================================
// NAVIGATION SETUP
// ==========================================
const Tab = createBottomTabNavigator();

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <EmergencyProvider>
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : (
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarActiveTintColor: '#4A90E2',
              tabBarInactiveTintColor: '#6A7690',
              tabBarIcon: ({ color, size }) => {
                let iconName;
                if (route.name === 'Home')          iconName = 'home';
                else if (route.name === 'Map')      iconName = 'map';
                else if (route.name === 'Alerts')   iconName = 'warning';
                else if (route.name === 'Insights') iconName = 'pulse';
                else if (route.name === 'Teams')    iconName = 'people';
                return <Ionicons name={iconName} size={size} color={color} />;
              },
            })}
          >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Map" component={MapScreen} />
            <Tab.Screen name="Alerts" component={AlertsScreen} />
            <Tab.Screen name="Insights" component={InsightsScreen} />
            <Tab.Screen name="Teams" component={RespondersScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      )}
    </EmergencyProvider>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  scrollContent: { padding: 20, paddingBottom: 150 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { padding: 20, paddingTop: 40, backgroundColor: 'rgba(11, 15, 25, 0.95)', borderBottomWidth: 1, borderBottomColor: '#1E2540' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  
  aiToggleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#131A2A', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#1E2540' },
  aiToggleTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  aiToggleSub: { color: '#6A7690', fontSize: 13, marginTop: 4 },

  statusCard: { backgroundColor: '#131A2A', padding: 30, borderRadius: 16, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 230, 118, 0.2)' },
  statusLabel: { color: '#8892B0', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  statusMain: { color: '#00E676', fontSize: 48, fontWeight: '900', marginVertical: 10, letterSpacing: 2 },
  statusSub: { color: '#A0AABF', fontSize: 14 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statBox: { backgroundColor: '#131A2A', padding: 20, borderRadius: 16, width: '31%', alignItems: 'center', borderWidth: 1, borderColor: '#1E2540' },
  statValue: { fontSize: 26, fontWeight: '900', marginBottom: 8 },
  statLabel: { fontSize: 10, color: '#8892B0', fontWeight: 'bold', letterSpacing: 1 },

  sectionTitle: { fontSize: 12, color: '#FFF', fontWeight: 'bold', letterSpacing: 2, marginBottom: 20, marginTop: 10 },
  
  timelineContainer: { paddingLeft: 10 },
  timelineItem: { flexDirection: 'row', marginBottom: 20, position: 'relative' },
  timelineLine: { position: 'absolute', left: 5, top: 15, bottom: -25, width: 2, backgroundColor: '#1E2540' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, zIndex: 10 },
  timelineContent: { marginLeft: 20, flex: 1 },
  timelineTime: { color: '#6A7690', fontSize: 12, marginBottom: 4 },
  timelineText: { color: '#FFF', fontSize: 15, fontWeight: '500' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 35, backgroundColor: 'rgba(11, 15, 25, 0.95)', borderTopWidth: 1, borderTopColor: '#1E2540' },
  leftActions: { flexDirection: 'row' },
  circleBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#131A2A', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#1E2540' },
  
  sosWrapper: { shadowColor: '#FF4444', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  sosGradient: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  sosText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginTop: 2 },

  map: { width, height: '100%' },
  mapOverlay: { position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: 'rgba(11, 15, 25, 0.95)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#FF2A55' },
  mapOverlayTitle: { color: '#FF2A55', fontWeight: '900', fontSize: 16 },
  mapOverlayText: { color: '#FFF', marginTop: 5 },

  // Map header bar (top)
  mapHeaderSafe: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'box-none' },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 8, backgroundColor: 'rgba(11,15,25,0.88)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1E2540' },
  mapHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapStatusDot: { width: 10, height: 10, borderRadius: 5 },
  mapHeaderTitle: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  mapHeaderCoord: { color: '#6A7690', fontSize: 10, marginTop: 1, fontFamily: 'monospace' },
  mapSatBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(30,37,64,0.9)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#2A3350' },
  mapSatBtnText: { color: '#A0AABF', fontSize: 11, fontWeight: 'bold' },

  // Right side floating controls
  mapRightControls: { position: 'absolute', right: 14, top: '35%', gap: 10 },
  mapCtrlBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(11,15,25,0.9)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E2540', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },

  // Legend popup
  legendCard: { position: 'absolute', right: 68, top: '35%', backgroundColor: 'rgba(11,15,25,0.95)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1E2540', minWidth: 170 },
  legendTitle: { color: '#8892B0', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLine: { width: 20, height: 3, borderRadius: 2 },
  legendText: { color: '#E2E8F0', fontSize: 13 },

  // Bottom info panel
  mapBottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(11,15,25,0.95)', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderTopColor: '#1E2540', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  mapBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapBottomStat: { flex: 1, alignItems: 'center', gap: 4 },
  mapBottomStatLabel: { color: '#6A7690', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.8, marginTop: 2 },
  mapBottomStatValue: { fontSize: 13, fontWeight: '900' },
  mapBottomDivider: { width: 1, height: 36, backgroundColor: '#1E2540' },
  mapBottomActionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1E2540' },
  mapEvacLabel: { color: '#FF2A55', fontSize: 12, fontWeight: '900' },
  mapEvacSub: { color: '#6A7690', fontSize: 11, marginTop: 3 },
  mapCallBtn: { backgroundColor: '#FF2A55', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6, marginLeft: 12 },
  mapCallBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  dangerMarker: { backgroundColor: 'rgba(255, 42, 85, 0.9)', padding: 8, borderRadius: 20 },
  dangerMarkerText: { fontSize: 24 },
  safeMarker: { backgroundColor: 'rgba(0, 230, 118, 0.15)', padding: 6, borderRadius: 20, borderWidth: 1, borderColor: '#00E676' },
  routeLoadingBadge: { position: 'absolute', bottom: 110, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(11,15,25,0.9)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1E2540', gap: 8 },
  routeLoadingText: { color: '#00E676', fontSize: 13, fontWeight: 'bold' },
  routeReadyBadge: { position: 'absolute', bottom: 110, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,230,118,0.12)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#00E676', gap: 6 },
  routeReadyText: { color: '#00E676', fontSize: 12, fontWeight: 'bold' },

  // Animated quote card floating on the map
  mapQuoteCard: { position: 'absolute', bottom: 215, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(11,15,25,0.82)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(0,240,255,0.15)', overflow: 'hidden' },
  mapQuoteText: { color: '#00F0FF', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  mapQuoteSub:  { color: '#6A7690', fontSize: 11, marginTop: 2 },

  alertCard: { backgroundColor: '#131A2A', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#1E2540' },
  alertType: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  alertDetail: { color: '#8892B0', marginTop: 5 },
  alertAction: { color: '#00E676', marginTop: 10, fontWeight: 'bold' },

  // Shared header sub
  headerSub: { color: '#6A7690', fontSize: 12, marginTop: 3 },

  // Empty state
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#131A2A', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#1E2540' },
  emptyTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 10 },
  emptyText: { color: '#6A7690', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Insights
  insightCard: { backgroundColor: '#131A2A', padding: 22, borderRadius: 16, marginBottom: 18, borderWidth: 1, borderColor: '#1E2540' },
  insightCardTitle: { color: '#8892B0', fontSize: 11, fontWeight: 'bold', letterSpacing: 2, marginBottom: 18 },
  riskCircleWrap: { alignSelf: 'center', width: 160, height: 160, marginVertical: 10, marginBottom: 20 },
  riskGradientRing: { width: '100%', height: '100%', borderRadius: 80, justifyContent: 'center', alignItems: 'center' },
  riskInnerCircle: { width: 136, height: 136, borderRadius: 68, backgroundColor: '#0B0F19', justifyContent: 'center', alignItems: 'center' },
  riskNumber: { fontSize: 52, fontWeight: '900', color: '#FFF' },
  riskUnit: { fontSize: 13, color: '#8892B0', fontWeight: 'bold' },
  predictionText: { color: '#4A90E2', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  confLabel: { color: '#8892B0', fontSize: 13, marginBottom: 8 },
  progressBarBg: { backgroundColor: '#0B0F19', borderRadius: 6, height: 10, width: '100%', marginBottom: 4 },
  progressBarFill: { height: 10, borderRadius: 6 },
  confValue: { color: '#FFF', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaChip: { backgroundColor: '#0B0F19', borderRadius: 10, padding: 12, width: '31%', alignItems: 'center', borderWidth: 1, borderColor: '#1E2540' },
  metaChipLabel: { color: '#6A7690', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6 },
  metaChipValue: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  explanationText: { color: '#E2E8F0', fontSize: 14, lineHeight: 24 },

  // Responders
  aiDispatchBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0,240,255,0.2)' },
  aiDispatchText: { color: '#00F0FF', fontWeight: '900', fontSize: 13, marginLeft: 10, letterSpacing: 0.5 },
  responderCard: { backgroundColor: '#131A2A', padding: 18, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1E2540' },
  responderCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  responderIconWrap: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  responderName: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  responderRole: { color: '#6A7690', fontSize: 12, marginTop: 2 },
  aiTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  aiTagText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  responderFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E2540' },
  responderStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  responderStatText: { color: '#8892B0', fontSize: 13, marginLeft: 5 },
  commsCard: { backgroundColor: '#131A2A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E2540' },
  commsRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E2540' },
  commsTime: { color: '#4A90E2', fontSize: 12, fontWeight: 'bold', width: 55 },
  commsMsg: { color: '#A0AABF', fontSize: 13, flex: 1 },

  // Emergency hotline quick dial strip
  hotlineRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  hotlineChip: { flex: 1, marginHorizontal: 3, backgroundColor: '#131A2A', borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  hotlineNum: { fontSize: 18, fontWeight: '900' },
  hotlineLabel: { fontSize: 10, color: '#6A7690', marginTop: 2, fontWeight: 'bold' },

  // Live call button on responder card
  callBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, gap: 4 },
  callBtnText: { fontSize: 12, fontWeight: 'bold' },

  // Location text under responder name
  responderLocation: { color: '#6A7690', fontSize: 11, marginTop: 2 },

  // Info banner at bottom
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(74,144,226,0.08)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,144,226,0.2)', marginTop: 16, gap: 10 },
  infoBannerText: { color: '#6A7690', fontSize: 12, flex: 1, lineHeight: 18 },

  tabBar: { backgroundColor: '#0B0F19', borderTopWidth: 1, borderTopColor: '#1E2540', paddingBottom: 10, paddingTop: 10, height: 65 },
});

const mapDarkStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#0B0F19" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#6A7690" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1E2540" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#131A2A" }] }
];
