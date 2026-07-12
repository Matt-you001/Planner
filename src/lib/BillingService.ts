import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

const REVENUECAT_GOOGLE_API_KEY =
  process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY || 'goog_KAujLQOyAOVMaUMAvtooKwxXJlN';
const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID || 'entl4964f8c4a5';

function getRevenueCatApiKey() {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_RC_APPLE_API_KEY;
  }

  if (Platform.OS === 'android') {
    return REVENUECAT_GOOGLE_API_KEY;
  }

  return undefined;
}

async function ensureConfigured(appUserID?: string | null) {
  if (!BillingService.isSupported()) {
    return false;
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return false;
  }

  const configured = await Purchases.isConfigured();
  if (!configured) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    Purchases.configure({
      apiKey,
      appUserID: appUserID || undefined,
    });
    return true;
  }

  if (appUserID) {
    await Purchases.logIn(appUserID);
  }

  return true;
}

function getBestOfferingPackage(offering: PurchasesOffering | null | undefined): PurchasesPackage | null {
  if (!offering) return null;

  return (
    offering.availablePackages?.find(pkg => pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL) ||
    offering.availablePackages?.find(pkg => pkg.packageType === Purchases.PACKAGE_TYPE.MONTHLY) ||
    offering.availablePackages?.[0] ||
    null
  );
}

export const BillingService = {
  entitlementId: REVENUECAT_ENTITLEMENT_ID,

  isSupported() {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },

  isConfiguredForCurrentPlatform() {
    return Boolean(getRevenueCatApiKey()) && this.isSupported();
  },

  async initialize(appUserID?: string | null) {
    return ensureConfigured(appUserID);
  },

  async syncUser(appUserID: string) {
    const configured = await ensureConfigured(appUserID);
    if (!configured) return null;
    return Purchases.getCustomerInfo();
  },

  async logout() {
    if (!this.isSupported()) return;
    const configured = await Purchases.isConfigured();
    if (configured) {
      await Purchases.logOut();
    }
  },

  async getCustomerInfo() {
    const configured = await ensureConfigured();
    if (!configured) return null;
    return Purchases.getCustomerInfo();
  },

  hasPremium(customerInfo: CustomerInfo | null | undefined) {
    if (!customerInfo) return false;
    return typeof customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== 'undefined';
  },

  async purchasePremium() {
    const configured = await ensureConfigured();
    if (!configured) {
      throw new Error('RevenueCat is not configured for this platform.');
    }

    const offerings = await Purchases.getOfferings();
    const selectedPackage = getBestOfferingPackage(offerings.current);

    if (!selectedPackage) {
      throw new Error('No purchasable premium package was found in the current RevenueCat offering.');
    }

    const result = await Purchases.purchasePackage(selectedPackage);
    return result.customerInfo;
  },

  async presentPremiumPaywall() {
    const configured = await ensureConfigured();
    if (!configured) {
      throw new Error('RevenueCat is not configured for this platform.');
    }

    // RevenueCat selects the current offering configured in its dashboard.
    await RevenueCatUI.presentPaywall({ displayCloseButton: true });
    return Purchases.getCustomerInfo();
  },

  async restorePurchases() {
    const configured = await ensureConfigured();
    if (!configured) {
      throw new Error('RevenueCat is not configured for this platform.');
    }

    return Purchases.restorePurchases();
  },
};
