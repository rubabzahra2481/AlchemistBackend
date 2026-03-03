const { IOSBackendService } = require('./dist/services/ios-backend.service');
const { ConfigService } = require('@nestjs/config');

async function test() {
  const config = new ConfigService();
  const service = new IOSBackendService(config);
  const userId = '04F894C8-70D1-70BF-B074-0FB778637A2B';
  
  console.log('Testing getUserProfile...');
  try {
    const result = await service.getUserProfile(userId);
    console.log('Result:', JSON.stringify(result, null, 2));
    if (result?.user?.tier) {
      console.log('✅ Tier found:', result.user.tier);
    } else {
      console.log('❌ Tier NOT found');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  console.log('\nTesting getUserById...');
  try {
    const result = await service.getUserById(userId);
    console.log('Result:', JSON.stringify(result, null, 2));
    if (result?.user?.tier) {
      console.log('✅ Tier found:', result.user.tier);
    } else {
      console.log('❌ Tier NOT found');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
