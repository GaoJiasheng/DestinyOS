import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useProfiles } from '../profiles';
import shuffle from '../../assets/audio/shuffle.mp3';
import flip from '../../assets/audio/flip.mp3';
import coin from '../../assets/audio/coin.mp3';
import palace from '../../assets/audio/palace.mp3';
import complete from '../../assets/audio/complete.mp3';
export type FeedbackKind = 'shuffle' | 'flip' | 'coin' | 'palace' | 'complete' | 'pick';
const sounds = { shuffle, flip, coin, palace, complete, pick: flip };
/** Route-scoped sound players and tactile vocabulary; no microphone or background playback. */
export function useRitualFeedback() {
  const { settings } = useProfiles();
  const preferences = useRef(settings);
  preferences.current = settings;
  const players = useRef(new Map<FeedbackKind, AudioPlayer>());
  const alive = useRef(true);
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
    players.current.forEach((player) => player.pause());
  }, []);
  useEffect(() => {
    alive.current = true;
    const ownedPlayers = players.current;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => {
      alive.current = false;
      stop();
      subscription.remove();
      ownedPlayers.forEach((player) => player.remove());
      ownedPlayers.clear();
    };
  }, [stop]);
  useEffect(() => {
    if (!settings.soundOn) stop();
  }, [settings.soundOn, stop]);
  const feedback = useCallback((kind: FeedbackKind) => {
    if (!alive.current || AppState.currentState !== 'active') return;
    if (preferences.current.hapticsOn) {
      const impact =
        kind === 'complete'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : kind === 'pick' || kind === 'palace'
            ? Haptics.selectionAsync()
            : Haptics.impactAsync(
                kind === 'coin'
                  ? Haptics.ImpactFeedbackStyle.Heavy
                  : kind === 'flip'
                    ? Haptics.ImpactFeedbackStyle.Medium
                    : Haptics.ImpactFeedbackStyle.Light,
              );
      void impact.catch(() => undefined);
    }
    if (!preferences.current.soundOn) return;
    const ticket = generation.current;
    void (async () => {
      await setAudioModeAsync({
        playsInSilentMode: false,
        allowsRecording: false,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      });
      if (
        !alive.current ||
        ticket !== generation.current ||
        !preferences.current.soundOn ||
        AppState.currentState !== 'active'
      )
        return;
      let player = players.current.get(kind);
      if (!player) {
        player = createAudioPlayer(sounds[kind]);
        players.current.set(kind, player);
      }
      await player.seekTo(0);
      if (alive.current && ticket === generation.current && preferences.current.soundOn)
        player.play();
    })().catch(() => undefined);
  }, []);
  return { feedback, stop };
}
