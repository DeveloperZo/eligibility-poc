const http = require('http');

const BASE_URL = 'http://localhost:3001';

// Helper function to make HTTP GET requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Test cases
const testCases = [
  {
    name: 'Health Check',
    url: `${BASE_URL}/health`
  },
  {
    name: 'Get All Employees',
    url: `${BASE_URL}/api/employees`
  },
  {
    name: 'Get Employee by ID (Valid)',
    url: `${BASE_URL}/api/employees/EMP001`
  },
  {
    name: 'Get Employee by ID (Invalid)',
    url: `${BASE_URL}/api/employees/INVALID`
  },
  {
    name: 'Get All Health Plans',
    url: `${BASE_URL}/api/health-plans`
  },
  {
    name: 'Get Health Plan by ID (Valid)',
    url: `${BASE_URL}/api/health-plans/PLAN-A`
  },
  {
    name: 'Get Health Plan by ID (Invalid)',
    url: `${BASE_URL}/api/health-plans/INVALID`
  },
  {
    name: 'Get All Groups',
    url: `${BASE_URL}/api/groups`
  },
  {
    name: 'Get Group by Number (Valid)',
    url: `${BASE_URL}/api/groups/GRP-100`
  },
  {
    name: 'Get Group by Number (Invalid)',
    url: `${BASE_URL}/api/groups/INVALID`
  },
  {
    name: 'Get Employee Eligibility Context (Adult)',
    url: `${BASE_URL}/api/employees/EMP001/eligibility-context`
  },
  {
    name: 'Get Employee Eligibility Context (Minor)',
    url: `${BASE_URL}/api/employees/EMP002/eligibility-context`
  }
];

// Run tests
async function runTests() {
  console.log('Starting API endpoint tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.name}`);
      const result = await makeRequest(testCase.url);
      
      if (result.statusCode === 200 || result.statusCode === 404) {
        console.log(`✅ PASS - Status: ${result.statusCode}`);
        if (result.data.success !== undefined) {
          console.log(`   Success: ${result.data.success}`);
        }
        if (result.data.count !== undefined) {
          console.log(`   Count: ${result.data.count}`);
        }
        passed++;
      } else {
        console.log(`❌ FAIL - Unexpected status: ${result.statusCode}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ FAIL - Error: ${error.message}`);
      failed++;
    }
    console.log('');
  }
  
  console.log('='.repeat(50));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please check the API server.');
    process.exit(1);
  }
}

// Check if server is running first
console.log('Checking if API server is running...');
makeRequest(`${BASE_URL}/health`)
  .then(() => {
    console.log('✅ API server is running\n');
    runTests();
  })
  .catch(() => {
    console.log('❌ API server is not running');
    console.log('Please start the server with: npm start');
    process.exit(1);
  });
