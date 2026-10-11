import Constants from 'expo-constants';
import { brand } from '@tianji/shared/brand';
/** Use the prebuild-selected first-party origin consistently for JSON, streams and knowledge. */
export const apiBaseUrl: string =
  typeof Constants.expoConfig?.extra?.API_BASE_URL === 'string'
    ? Constants.expoConfig.extra.API_BASE_URL
    : `https://${brand.domain}`;
