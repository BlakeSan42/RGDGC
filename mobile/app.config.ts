import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'RGDGC',
  slug: 'rgdgc',
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8001',
    googleExpoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || 'abf9a20a-a221-44aa-a812-e8b62db0a2cb',
    },
  },
});
