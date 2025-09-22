import { db } from './index';
import { posts, users } from './schema';
import bcrypt from 'bcryptjs';

const seedData = [
  {
    email: 'allianceconf17@gmail.com',
    content: 'IT MNC BLR, 40+, 5\'6", Fair, North Indian Saryupar Brahmin. allianceconf17@gmail.com',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'dr.sharma11@gmail.com',
    content: 'WANTED BRIDE: For Fair, Handsome Brahmin Boy, Born 1991, 5\'8". MBA from prestigious Stanford University (USA), BTech (Steel from NIT Durgapur), Gold Medalist. Rich Affluent Family of Doctors and MBAs from Bhopal, India. Mob.: 9399820743',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'ashtal2012@gmail.com',
    content: 'Wanted PQM for May 1994 Born 5\'5" Slim Boy, Smart, Non Smoker, Occasional Drinker, Well Educated, Now Buys in US, based New Jersey. High Status, Well Educated Beautiful Match Sought. Caste No Bar. Please email Bio-data with Latest Photograph at ashtal2012@gmail.com',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'sinhaassociates27@gmail.com',
    content: 'MBBS, MD Ansh Tatha Kay, Bride 22.7.87, 5\'2", Mum, D. dlib Cardiol & C care MRCP P-1 & II dr MD by Doctors. sinhaassociates27@gmail.com',
    lookingFor: 'groom' as const,
    fontSize: 'large' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },
  {
    email: 'bhardwalm@hotmail.com',
    content: 'UMBR Boy 5/9/1977, permanent Govt. Job, Own House in Delhi, Seeks Educated, Beautiful Girl. bhardwalm@hotmail.com',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },
  {
    email: 'alliance2024@gmail.com',
    content: 'Alliance invited for Handsome Manglik Boy, 28 years, B.Tech M.Tech, working as Software Engineer in MNC Delhi. Well settled with own house. Height 5\'8". Family from Delhi. Looking for educated, working girl from good family. Brahmin preferred but case no bar for right match. Contact: +91 98765 43210',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },
  {
    email: 'deepakahuja989@gmail.com',
    content: 'SINDHI Mumbai based, DLF City, Gurgaon based, seeks well settled, beautiful, educated, cultured, family oriented, Sindhi girl. deepakahuja989@gmail.com WhatsApp: 9810274346',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'khatriboy@gmail.com',
    content: 'Khatri Boy 85/5\'6" Chartered Accountant, Gurgaon, working in MNC, Seeks beautiful, educated, working girl. khatriboy@gmail.com',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'dr.radiology@gmail.com',
    content: '32 Bhadauriya (Rajput), 32/5\'11" B.Tech IT, 25 LPA, Rajput, 5\'11" B.Tech IT, 25 LPA, Seeks UK based girl. 9465272154, 8375072252',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'govt.defence@gmail.com',
    content: 'MTECH, Gorakhpur Boy, 6\'0", 1992, 40 LPA, Govt. Defence, Seeks Educated Girl. 9811481467',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },
  {
    email: 'mba.wharton@gmail.com',
    content: 'MBA Wharton, Maithili, 5\'8", 1991, 45 LPA, Ivy League & Prof. Girl. 9410253669',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },
  {
    email: 'kurmimatch@gmail.com',
    content: 'SUITABLE MATCH INVITED FOR Eng. Boy DOING PHD FROM REPUTED TATEL FAMILY. SEEKS QUALIFIED WORKING GIRL. Age 26. kurmimatch@gmail.com',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },
  {
    email: 'radiologyodv@gmail.com',
    content: 'RADIOLOGY ODV, 37 yrs, 5\'6" N.Mplk MBBS MD, Seeks MBBS/MD Girl. 9871376010, 9871376011',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'vaishmatch@gmail.com',
    content: 'SM4 Vaish, 5\'11" Faridabad, 27/5\'11", 1996, CA, Seeks CA/CS/ICWA Girl. vaishmatch@gmail.com',
    lookingFor: 'bride' as const,
    fontSize: 'medium' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'govtjobboy@gmail.com',
    content: 'Working in state government office. Good salary. Family has land and property. Seeks govt employee or businessman.',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'armyofficer@gmail.com',
    content: 'Serving army officer posted in North India. Height 5\'10". Good physique. Seeks homely educated girl from good family background.',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },
  {
    email: 'usdoctor@gmail.com',
    content: 'US citizen doctor practicing in California. Seeks educated girl willing to relocate. Age no bar. Good family background important. WhatsApp: +1-555-123-4567',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },
  {
    email: 'pharmacistgujarat@gmail.com',
    content: 'Working pharmacist from traditional Gujarati family. Knows cooking, household work. Seeks well-settled boy preferably from Gujarat.',
    lookingFor: 'groom' as const,
    fontSize: 'medium' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },
  {
    email: 'staffnurse@gmail.com',
    content: 'Working as staff nurse in private hospital. From middle-class family. Seeks doctor or medical professional. Simple marriage.',
    lookingFor: 'groom' as const,
    fontSize: 'default' as const,
    bgColor: '#f0f8ff',
    status: 'published' as const
  },
  {
    email: 'bengalimatch@gmail.com',
    content: 'BENGALI match for Kayastha girl, 5\'4", 1996, Delhi based, Seeks Bengali boy. 9410253669',
    lookingFor: 'groom' as const,
    fontSize: 'default' as const,
    bgColor: '#f5f5dc',
    status: 'published' as const
  },
  {
    email: 'mathurmatch@gmail.com',
    content: 'MATHUR fair slim girl, June 94/5\'8", Bhatnagar Kayastha, Seeks Bhatnagar boy. 9811481467',
    lookingFor: 'groom' as const,
    fontSize: 'medium' as const,
    bgColor: '#f0fff0',
    status: 'published' as const
  },
  {
    email: 'canadabrahmin@gmail.com',
    content: 'CANADA based Punjabi Brahmin boy, 5\'11", 1990, Seeks girl from Canada/US. 9876543210',
    lookingFor: 'bride' as const,
    fontSize: 'large' as const,
    bgColor: '#fff0f5',
    status: 'published' as const
  },
  {
    email: 'delhiboy@gmail.com',
    content: 'DELHI NCR based Mathur boy, 5\'10", 1992, Seeks Kayastha girl. 9876543210',
    lookingFor: 'bride' as const,
    fontSize: 'default' as const,
    bgColor: '#f8f8ff',
    status: 'published' as const
  },
  {
    email: 'rajputmedico@gmail.com',
    content: 'MEDICO match for Chauhan Rajput girl, 5\'0", MS Ophthalmology, 28, Seeks medical family from reputed hospital. 7888887304',
    lookingFor: 'groom' as const,
    fontSize: 'medium' as const,
    bgColor: '#faf0e6',
    status: 'published' as const
  },
];

async function seed() {
  try {
    // Clear existing data
    await db.delete(posts);
    await db.delete(users);

    // Create users first
    const createdUsers: any[] = [];
    for (const postData of seedData) {
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
    const postsWithUsers = seedData.map((postData, index) => ({
      ...postData,
      userId: createdUsers[index].id,
      expiresAt: new Date(Date.now() + (20 * 24 * 60 * 60 * 1000)), // 20 days from now
    }));

    await db.insert(posts).values(postsWithUsers);
    
    console.log('Seeded posts and users tables with sample data.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed(); 