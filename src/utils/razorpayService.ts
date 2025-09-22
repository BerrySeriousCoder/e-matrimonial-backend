import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_SECRET!,
});

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: number;
}

export interface PaymentLinkResponse {
  id: string;
  short_url: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  created_at: string;
  expire_by?: number;
  reference_id: string;
}

export class RazorpayService {
  /**
   * Create a payment link for a post
   */
  static async createPaymentLink(
    amount: number,
    postId: number,
    userEmail: string,
    description: string,
    expireBy?: number
  ): Promise<PaymentLinkResponse> {
    try {
      const paymentLink = await razorpay.paymentLink.create({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        description: description,
        customer: {
          email: userEmail,
        },
        notify: {
          sms: false,
          email: true,
        },
        reminder_enable: true,
        callback_url: `${process.env.CLIENT_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
        callback_method: 'get',
        reference_id: `post_${postId}`,
        expire_by: expireBy,
      });

      return {
        ...paymentLink,
        amount: typeof paymentLink.amount === 'string' ? parseInt(paymentLink.amount) : paymentLink.amount,
        currency: paymentLink.currency || 'INR',
        description: paymentLink.description || `Payment for Post #${postId}`,
        reference_id: paymentLink.reference_id || `post_${postId}`
      };
    } catch (error) {
      console.error('Error creating payment link:', error);
      throw new Error('Failed to create payment link');
    }
  }

  /**
   * Verify payment signature
   */
  static verifyPaymentSignature(
    paymentLinkId: string,
    paymentId: string,
    paymentLinkReferenceId: string,
    paymentLinkStatus: string,
    signature: string
  ): boolean {
    try {
      const payload = `${paymentLinkId}|${paymentId}|${paymentLinkReferenceId}|${paymentLinkStatus}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_SECRET!)
        .update(payload)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Error verifying payment signature:', error);
      return false;
    }
  }

  /**
   * Get payment details
   */
  static async getPaymentDetails(paymentId: string) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('Error fetching payment details:', error);
      throw new Error('Failed to fetch payment details');
    }
  }

  /**
   * Get payment link details
   */
  static async getPaymentLinkDetails(paymentLinkId: string) {
    try {
      const paymentLink = await razorpay.paymentLink.fetch(paymentLinkId);
      return paymentLink;
    } catch (error) {
      console.error('Error fetching payment link details:', error);
      throw new Error('Failed to fetch payment link details');
    }
  }

  /**
   * Cancel a payment link
   */
  static async cancelPaymentLink(paymentLinkId: string) {
    try {
      const paymentLink = await razorpay.paymentLink.cancel(paymentLinkId);
      return paymentLink;
    } catch (error) {
      console.error('Error cancelling payment link:', error);
      throw new Error('Failed to cancel payment link');
    }
  }

  /**
   * Resend payment link notification
   */
  static async resendPaymentLinkNotification(paymentLinkId: string, medium: 'email' | 'sms') {
    try {
      const response = await razorpay.paymentLink.notifyBy(paymentLinkId, medium);
      return response;
    } catch (error) {
      console.error('Error resending payment link notification:', error);
      throw new Error('Failed to resend payment link notification');
    }
  }
}

export default RazorpayService;
