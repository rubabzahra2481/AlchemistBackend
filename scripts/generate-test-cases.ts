import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface TestCase {
  category: string;
  input: string;
  expectedBehavior: string;
  shouldContain?: string[];
  shouldNOTcontain?: string[];
  maxLength?: number;
}

/**
 * Generate diverse test cases using GPT-4
 */
async function generateTestCases(): Promise<TestCase[]> {
  console.log('🔄 Generating test cases using GPT-4...\n');

  const categories = [
    {
      name: 'emotional_support',
      count: 50,
      prompt: `Generate 50 different ways real users express emotional distress, including:
- Stress and overwhelm
- Feeling like a failure
- Low self-esteem
- Anxiety and worry
- Depression and hopelessness
- Burnout

Include variations:
- Different phrasings
- Casual language ("im so stressed rn")
- Typos and informal grammar
- Different intensities (mild to severe)

Return as JSON array: [{"input": "...", "severity": "mild|moderate|severe"}]`
    },
    {
      name: 'business_career',
      count: 40,
      prompt: `Generate 40 different ways users ask about business and career issues:
- Starting a business
- Career changes
- Work-life balance
- Job dissatisfaction
- First steps / don't know where to start
- Fear of failure in career

Include casual and formal language, typos, different phrasings.
Return as JSON array: [{"input": "..."}]`
    },
    {
      name: 'self_improvement',
      count: 30,
      prompt: `Generate 30 different ways users ask about personal development:
- Learning new skills
- Becoming more creative
- Improving social skills
- Building confidence
- Developing discipline

Return as JSON array: [{"input": "..."}]`
    },
    {
      name: 'relationship_social',
      count: 25,
      prompt: `Generate 25 different ways users express social/relationship issues:
- Loneliness
- Social anxiety
- Friendship problems
- Feeling misunderstood
- Relationship conflicts

Return as JSON array: [{"input": "..."}]`
    },
    {
      name: 'edge_cases',
      count: 20,
      prompt: `Generate 20 edge case messages:
- Deflection ("I'm fine", "not a big deal")
- Asking for a friend
- Minimization
- Contradictory statements
- Ambiguous messages
- Sarcasm or humor
- Very short messages
- Typos and errors

Return as JSON array: [{"input": "...", "type": "..."}]`
    }
  ];

  const allTestCases: TestCase[] = [];

  for (const category of categories) {
    console.log(`Generating ${category.count} test cases for: ${category.name}`);

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a test case generator. Return valid JSON only, no markdown formatting.'
          },
          {
            role: 'user',
            content: category.prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9 // High creativity for diverse cases
      });

      const content = response.choices[0].message.content;
      const generated = content ? JSON.parse(content) : [];
      const cases = Array.isArray(generated) ? generated : (generated.cases || generated.inputs || []);

      cases.forEach((item: any) => {
        allTestCases.push({
          category: category.name,
          input: item.input,
          expectedBehavior: getExpectedBehavior(category.name, item),
          shouldNOTcontain: ['score', 'percentile', 'DASS', 'RSE', 'Big Five', 'quotient'],
          maxLength: 400
        });
      });

      console.log(`✅ Generated ${cases.length} cases for ${category.name}\n`);
      
      // Wait to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Error generating ${category.name}:`, error.message);
    }
  }

  return allTestCases;
}

/**
 * Define expected behavior based on category
 */
function getExpectedBehavior(category: string, item: any): string {
  switch (category) {
    case 'emotional_support':
      const severity = item.severity || 'moderate';
      if (severity === 'severe') {
        return 'Should validate feelings and suggest professional help if needed';
      }
      return 'Should provide empathetic support and specific coping strategies';
    
    case 'business_career':
      return 'Should give specific actionable steps, not generic "create business plan" advice';
    
    case 'self_improvement':
      return 'Should provide concrete exercises or practices, not vague suggestions';
    
    case 'relationship_social':
      return 'Should give practical social advice, validate feelings';
    
    case 'edge_cases':
      return `Should handle ${item.type} appropriately`;
    
    default:
      return 'Should respond appropriately';
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║     Test Case Generator - GPT-4 Powered           ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  const testCases = await generateTestCases();

  console.log(`\n✅ Generated ${testCases.length} total test cases`);
  console.log('\nBreakdown by category:');
  
  const breakdown: any = {};
  testCases.forEach(tc => {
    breakdown[tc.category] = (breakdown[tc.category] || 0) + 1;
  });
  
  Object.entries(breakdown).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} cases`);
  });

  // Save to file
  const outputPath = path.join(__dirname, '..', 'test', 'generated-test-cases.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    generated: new Date().toISOString(),
    totalCases: testCases.length,
    testCases
  }, null, 2));

  console.log(`\n💾 Saved to: ${outputPath}`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { generateTestCases };

