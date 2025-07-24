import { db } from './index';
import { uiTexts } from './schema';

const defaultTexts = [
  {
    key: 'select',
    value: 'Select',
    description: 'Button text for selecting a profile'
  },
  {
    key: 'unselect',
    value: 'Unselect',
    description: 'Button text for unselecting a profile'
  },
  {
    key: 'email',
    value: 'Email',
    description: 'Button text for emailing a profile'
  },
  {
    key: 'yourEmail',
    value: 'Your Email',
    description: 'Label for sender email field in email dialog'
  },
  {
    key: 'receiverEmail',
    value: 'Receiver Email',
    description: 'Label for receiver email field in email dialog'
  },
  {
    key: 'message',
    value: 'Message',
    description: 'Label for message field in email dialog'
  },
  {
    key: 'postAd',
    value: 'Post Your Ad',
    description: 'Button text for posting a new ad'
  },
  {
    key: 'adContent',
    value: 'Describe yourself or your requirement',
    description: 'Label for ad content textarea'
  },
  {
    key: 'sendEmail',
    value: 'Send Email',
    description: 'Button text for sending email'
  },
  {
    key: 'cancel',
    value: 'Cancel',
    description: 'Button text for canceling actions'
  },
  {
    key: 'close',
    value: 'Close',
    description: 'Button text for closing dialogs'
  },
  {
    key: 'submit',
    value: 'Submit',
    description: 'Button text for submitting forms'
  },
  {
    key: 'login',
    value: 'Login',
    description: 'Button text for login'
  },
  {
    key: 'register',
    value: 'Register',
    description: 'Button text for registration'
  },
  {
    key: 'logout',
    value: 'Logout',
    description: 'Button text for logout'
  },
  {
    key: 'emailPlaceholder',
    value: 'Enter your email address',
    description: 'Placeholder text for email input fields'
  },
  {
    key: 'messagePlaceholder',
    value: 'Type your message here...',
    description: 'Placeholder text for message textarea'
  },
  {
    key: 'contentPlaceholder',
    value: 'Describe yourself, your requirements, or the person you are looking for...',
    description: 'Placeholder text for ad content textarea'
  },
  {
    key: 'requestOtp',
    value: 'Request OTP',
    description: 'Button text for requesting OTP'
  },
  {
    key: 'verifyOtp',
    value: 'Verify OTP',
    description: 'Button text for verifying OTP'
  },
  {
    key: 'otpPlaceholder',
    value: 'Enter 6-digit OTP',
    description: 'Placeholder text for OTP input field'
  },
  {
    key: 'password',
    value: 'Password',
    description: 'Label for password field'
  },
  {
    key: 'passwordPlaceholder',
    value: 'Enter your password',
    description: 'Placeholder text for password field'
  },
  {
    key: 'confirmPassword',
    value: 'Confirm Password',
    description: 'Label for confirm password field'
  },
  {
    key: 'confirmPasswordPlaceholder',
    value: 'Confirm your password',
    description: 'Placeholder text for confirm password field'
  },
  {
    key: 'filterAll',
    value: 'All',
    description: 'Filter option for showing all posts'
  },
  {
    key: 'filterSelected',
    value: 'Selected',
    description: 'Filter option for showing selected posts'
  },
  {
    key: 'filterBride',
    value: 'Looking for Bride',
    description: 'Filter option for bride posts'
  },
  {
    key: 'filterGroom',
    value: 'Looking for Groom',
    description: 'Filter option for groom posts'
  }
];

async function seedUiTexts() {
  try {
    console.log('Seeding UI texts...');
    
    for (const text of defaultTexts) {
      await db
        .insert(uiTexts)
        .values(text)
        .onConflictDoUpdate({
          target: uiTexts.key,
          set: { value: text.value, description: text.description, updatedAt: new Date() }
        });
    }
    
    console.log('UI texts seeded successfully!');
  } catch (error) {
    console.error('Error seeding UI texts:', error);
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedUiTexts().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Failed to seed UI texts:', error);
    process.exit(1);
  });
}

export { seedUiTexts }; 