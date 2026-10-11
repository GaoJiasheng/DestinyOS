/** Load the optional native ads SDK only after inventory and consent gates pass. */
export const loadAdsSdk = () => import('react-native-google-mobile-ads');
