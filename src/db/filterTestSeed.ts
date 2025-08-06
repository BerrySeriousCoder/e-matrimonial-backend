import { db } from './index';
import { posts, users } from './schema';
import bcrypt from 'bcryptjs';

const filterTestData = [
  // Complexion & Appearance Tests
  {
    email: 'fairgirl@gmail.com',
    content: 'Fair and beautiful girl, 25 years old, 5\'6" height. Looking for educated boy from good family. Fair complexion preferred.',
    lookingFor: 'groom' as const,
    fontSize: 'default' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'goriboy@gmail.com',
    content: 'Gori boy from Delhi, 28 years, working in IT company. Seeks gori girl for marriage. Contact: gori boy',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'tallgroom@gmail.com',
    content: 'Tall handsome boy, 6\'2" height, 30 years old. Working as software engineer. Seeks tall girl.',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'wheatishgirl@gmail.com',
    content: 'Wheatish complexion girl, 26 years, 5\'4". Well educated and cultured. Looking for wheatish boy.',
    lookingFor: 'groom' as const,
    fontSize: 'default' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },

  // Education & Profession Tests
  {
    email: 'mbaexecutive@gmail.com',
    content: 'MBA from IIM Ahmedabad, working as senior executive in MNC. 32 years old, 5\'10". Seeks MBA girl.',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },
  {
    email: 'btechsoftware@gmail.com',
    content: 'B.Tech in Computer Science, working as software developer in tech company. 27 years, 5\'8".',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },
  {
    email: 'mbbsdoctor@gmail.com',
    content: 'MBBS doctor working in government hospital. 29 years old, 5\'7". Seeks MBBS or medical professional.',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'iimgraduate@gmail.com',
    content: 'IIM graduate, working in consulting firm. 31 years, 5\'9". Looking for IIM or top B-school graduate.',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'mncmanager@gmail.com',
    content: 'Working in MNC as project manager. 33 years old, 5\'11". Seeks MNC working girl.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'govtofficer@gmail.com',
    content: 'Government officer in state department. 35 years, 5\'8". Looking for govt job holder.',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },

  // Age & Height Tests
  {
    email: 'age25girl@gmail.com',
    content: '25 years old girl, 5\'6" height. Working as teacher. Looking for boy age 25-30.',
    lookingFor: 'groom' as const,
    fontSize: 'default' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },
  {
    email: 'age30boy@gmail.com',
    content: '30 years old boy, 5\'8" height. Software engineer. Seeks girl age 25-30.',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },
  {
    email: 'height56girl@gmail.com',
    content: 'Girl with height 5\'6", 26 years old. Working in bank. Looking for boy height 5\'6" or above.',
    lookingFor: 'groom' as const,
    fontSize: 'large' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'height58boy@gmail.com',
    content: 'Boy with height 5\'8", 28 years old. Business analyst. Seeks girl height 5\'8" or below.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },

  // Overseas Status Tests
  {
    email: 'nriboy@gmail.com',
    content: 'NRI boy working in USA. 32 years old, 5\'10". Seeks NRI girl or willing to relocate.',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'greencardgirl@gmail.com',
    content: 'Girl with green card, working in California. 29 years, 5\'5". Looking for green card holder.',
    lookingFor: 'groom' as const,
    fontSize: 'large' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },
  {
    email: 'workingabroad@gmail.com',
    content: 'Working abroad in UK. 31 years old, 5\'9". Seeks girl working abroad or willing to relocate.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },

  // Abbreviations/SMS Style Tests
  {
    email: 'smgirl@gmail.com',
    content: 'SM$ girl, 26 years, working in IT. Looking for SM$ boy. Contact for details.',
    lookingFor: 'groom' as const,
    fontSize: 'medium' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },
  {
    email: 'pqmboy@gmail.com',
    content: 'PQM boy, 28 years, well settled. Seeks PQM girl. Good family background.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'edugirl@gmail.com',
    content: 'Edu girl, 25 years, highly educated. Looking for edu boy. Professional background.',
    lookingFor: 'groom' as const,
    fontSize: 'large' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'hsomeboy@gmail.com',
    content: 'H\'some boy, 27 years, 5\'10". Working in MNC. Seeks h\'some girl.',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'bfulgirl@gmail.com',
    content: 'B\'ful girl, 24 years, 5\'6". Well educated and cultured. Looking for b\'ful boy.',
    lookingFor: 'groom' as const,
    fontSize: 'default' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },

  // Astrology Labels Tests
  {
    email: 'manglikboy@gmail.com',
    content: 'Manglik boy, 29 years, working as engineer. Seeks manglik girl for marriage.',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },
  {
    email: 'nonmanglikgirl@gmail.com',
    content: 'Non-manglik girl, 26 years, working in bank. Looking for non-manglik boy.',
    lookingFor: 'groom' as const,
    fontSize: 'medium' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },

  // Multiple Filter Combinations
  {
    email: 'fairmbaboy@gmail.com',
    content: 'Fair MBA boy, 30 years, 5\'8", working in MNC. Seeks fair MBA girl.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'tallnrigirl@gmail.com',
    content: 'Tall NRI girl, 28 years, 5\'7", working abroad. Looking for tall NRI boy.',
    lookingFor: 'groom' as const,
    fontSize: 'medium' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'mbbsmanglik@gmail.com',
    content: 'MBBS manglik boy, 31 years, 5\'9", working as doctor. Seeks MBBS manglik girl.',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'hsomegreencard@gmail.com',
    content: 'H\'some green card holder, 29 years, 5\'10", working in USA. Looking for h\'some green card girl.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },
  {
    email: 'pqmeduboy@gmail.com',
    content: 'PQM edu boy, 27 years, 5\'8", highly educated. Seeks PQM edu girl.',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },
  {
    email: 'bfulgovtgirl@gmail.com',
    content: 'B\'ful govt job girl, 25 years, 5\'5", working in government office. Looking for b\'ful govt boy.',
    lookingFor: 'groom' as const,
    fontSize: 'large' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },
  {
    email: 'fairiimnonmanglik@gmail.com',
    content: 'Fair IIM graduate non-manglik boy, 32 years, 5\'9", working in consulting. Seeks fair IIM non-manglik girl.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'tallmbaworkingabroad@gmail.com',
    content: 'Tall MBA working abroad, 30 years, 5\'11", in UK. Looking for tall MBA working abroad girl.',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'smbtechgreencard@gmail.com',
    content: 'SM$ B.Tech green card holder, 28 years, 5\'8", in California. Seeks SM$ B.Tech green card girl.',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'hsomegovtmanglik@gmail.com',
    content: 'H\'some govt job manglik boy, 29 years, 5\'9", working in government. Looking for h\'some govt manglik girl.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  }
];

async function seedFilterTestData() {
  try {
    console.log('Starting to seed filter test data...');

    // Create users first
    const createdUsers: any[] = [];
    for (const postData of filterTestData) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const [user] = await db.insert(users)
        .values({ 
          email: postData.email, 
          password: hashedPassword 
        })
        .returning();
      createdUsers.push(user);
    }

    // Create posts with userId references
    const postsWithUsers = filterTestData.map((postData, index) => ({
      ...postData,
      userId: createdUsers[index].id,
      expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days from now
    }));

    await db.insert(posts).values(postsWithUsers);
    
    console.log(`✅ Successfully seeded ${filterTestData.length} posts for filter testing.`);
    console.log('📋 Test data includes:');
    console.log('   • Complexion terms: fair, gori, tall, wheatish');
    console.log('   • Education terms: MBA, B.Tech, MBBS, IIM, MNC, Govt Job');
    console.log('   • Age/Height terms: age 25-30, age 30-35, height 5\'6", height 5\'8"');
    console.log('   • Overseas terms: NRI, Green Card, Working Abroad');
    console.log('   • Abbreviations: SM$, PQM, Edu, H\'some, B\'ful');
    console.log('   • Astrology: Manglik, Non-Manglik');
    console.log('   • Multiple combinations for comprehensive testing');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding filter test data:', error);
    process.exit(1);
  }
}

seedFilterTestData(); 