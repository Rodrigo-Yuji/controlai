import { Capacitor, registerPlugin } from '@capacitor/core';

export const nativeSpeech = Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
export const SpeechInput = registerPlugin<{start():Promise<{text:string}>; openSettings():Promise<void>}>('SpeechInput');
