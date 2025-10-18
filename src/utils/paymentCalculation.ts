import { db } from '../db';
import { paymentConfigs, couponCodes } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface PaymentCalculation {
  baseAmount: number;
  characterCount: number;
  additionalCharacters: number;
  additionalCost: number;
  iconCost: number;
  fontMultiplier: number;
  visibilityMultiplier: number;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  couponCode?: string;
  couponValid?: boolean;
}

export interface PaymentConfig {
  basePriceFirst200: number;
  additionalPricePer20Chars: number;
  largeFontMultiplier: number;
  visibility2WeeksMultiplier: number;
  visibility3WeeksMultiplier: number;
  visibility4WeeksMultiplier: number;
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const [config] = await db.select().from(paymentConfigs).where(eq(paymentConfigs.id, 1));
  
  if (!config) {
    // Return default config if none exists
    return {
      basePriceFirst200: 5000,
      additionalPricePer20Chars: 500,
      largeFontMultiplier: 1.20,
      visibility2WeeksMultiplier: 1.00,
      visibility3WeeksMultiplier: 1.50,
      visibility4WeeksMultiplier: 2.00,
    };
  }

  return {
    basePriceFirst200: config.basePriceFirst200,
    additionalPricePer20Chars: config.additionalPricePer20Chars,
    largeFontMultiplier: Number(config.largeFontMultiplier),
    visibility2WeeksMultiplier: Number(config.visibility2WeeksMultiplier),
    visibility3WeeksMultiplier: Number(config.visibility3WeeksMultiplier),
    visibility4WeeksMultiplier: Number(config.visibility4WeeksMultiplier),
  };
}

export async function calculatePaymentAmount(
  content: string,
  fontSize: 'default' | 'large',
  duration: 14 | 21 | 28, // 2, 3, 4 weeks
  couponCode?: string,
  icon?: string
): Promise<PaymentCalculation> {
  const config = await getPaymentConfig();
  
  // Gracefully handle empty or short content for base summary rendering
  const characterCount = Math.max(0, (content || '').length);
  const additionalCharacters = Math.max(0, characterCount - 200);
  const additionalCost = Math.ceil(additionalCharacters / 20) * config.additionalPricePer20Chars;
  
  // Base amount should reflect ONLY the first 200 characters price.
  // Additional characters are shown separately and added when computing subtotal.
  const baseAmount = config.basePriceFirst200;
  
  // Font multiplier
  const fontMultiplier = fontSize === 'large' ? config.largeFontMultiplier : 1.0;
  
  // Visibility multiplier based on duration
  let visibilityMultiplier: number;
  if (duration === 14) {
    visibilityMultiplier = config.visibility2WeeksMultiplier;
  } else if (duration === 21) {
    visibilityMultiplier = config.visibility3WeeksMultiplier;
  } else if (duration === 28) {
    visibilityMultiplier = config.visibility4WeeksMultiplier;
  } else {
    visibilityMultiplier = 1.0; // Default fallback
  }
  
  // Icon cost (100 rupees if icon is selected)
  const iconCost = icon ? 100 : 0;
  
  // Subtotal is computed on (base + additional + icon) before applying multipliers
  const subtotalBeforeMultipliers = baseAmount + additionalCost + iconCost;
  const subtotal = Math.round(subtotalBeforeMultipliers * fontMultiplier * visibilityMultiplier);
  
  // Apply coupon discount if provided
  let discountAmount = 0;
  let couponValid = false;
  
  if (couponCode) {
    const [coupon] = await db.select()
      .from(couponCodes)
      .where(eq(couponCodes.code, couponCode));
    
    if (coupon && coupon.isActive) {
      // Check if coupon has expired
      const now = new Date();
      const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;
      
      // Check usage limit
      const isUsageExceeded = coupon.usageLimit && coupon.usedCount >= coupon.usageLimit;
      
      if (!isExpired && !isUsageExceeded) {
        couponValid = true;
        discountAmount = Math.round((subtotal * Number(coupon.discountPercentage)) / 100);
      }
    }
  }
  
  const finalAmount = Math.max(0, subtotal - discountAmount);
  
  return {
    baseAmount,
    characterCount,
    additionalCharacters,
    additionalCost,
    iconCost,
    fontMultiplier,
    visibilityMultiplier,
    subtotal,
    discountAmount,
    finalAmount,
    couponCode: couponValid ? couponCode : undefined,
    couponValid,
  };
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function getCharacterPricingBreakdown(characterCount: number, config: PaymentConfig) {
  const baseCharacters = Math.min(characterCount, 200);
  const additionalCharacters = Math.max(0, characterCount - 200);
  const additionalChunks = Math.ceil(additionalCharacters / 20);
  
  return {
    baseCharacters,
    additionalCharacters,
    additionalChunks,
    baseCost: config.basePriceFirst200,
    additionalCost: additionalChunks * config.additionalPricePer20Chars,
    totalBaseCost: config.basePriceFirst200 + (additionalChunks * config.additionalPricePer20Chars),
  };
}
