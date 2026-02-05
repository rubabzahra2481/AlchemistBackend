import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface FailurePattern {
  issue: string;
  frequency: number;
  affectedCategories: string[];
  examples: Array<{
    input: string;
    response: string;
    category: string;
  }>;
  suggestedFix: string;
  confidence: 'high' | 'medium' | 'low';
  filesAffected: string[];
}

/**
 * Analyze failures using GPT-4 to find patterns
 */
async function analyzeFailures(failedTests: any[]): Promise<FailurePattern[]> {
  console.log(`\n🔍 Analyzing ${failedTests.length} failures for patterns...\n`);

  // Group by issue type
  const issueGroups: any = {};
  failedTests.forEach(test => {
    test.issues.forEach((issue: string) => {
      if (!issueGroups[issue]) {
        issueGroups[issue] = [];
      }
      issueGroups[issue].push(test);
    });
  });

  const patterns: FailurePattern[] = [];

  for (const [issue, tests] of Object.entries(issueGroups) as [string, any[]][]) {
    if (tests.length < 2) continue; // Skip one-off issues

    console.log(`Analyzing: ${issue} (${tests.length} cases)`);

    // Get examples
    const examples = tests.slice(0, 5).map(t => ({
      input: t.input,
      response: t.response,
      category: t.category
    }));

    // Use GPT-4 to suggest fix
    const suggestedFix = await suggestFix(issue, examples);

    const affectedCategories = [...new Set(tests.map((t: any) => t.category))];

    patterns.push({
      issue,
      frequency: tests.length,
      affectedCategories,
      examples,
      suggestedFix: suggestedFix.fix,
      confidence: suggestedFix.confidence,
      filesAffected: suggestedFix.filesAffected
    });
  }

  // Sort by frequency
  patterns.sort((a, b) => b.frequency - a.frequency);

  return patterns;
}

/**
 * Use GPT-4 to suggest specific fixes
 */
async function suggestFix(issue: string, examples: any[]): Promise<any> {
  const examplesText = examples.map((ex, idx) => 
    `Example ${idx + 1}:
Input: "${ex.input}"
Response: "${ex.response}"
Category: ${ex.category}`
  ).join('\n\n');

  const prompt = `You are analyzing failures in an AI advice agent.

ISSUE: ${issue}

EXAMPLES OF FAILURES:
${examplesText}

Based on these failures, provide a SPECIFIC fix.

Consider these files:
- src/services/advice-generator.service.ts (lines 50-400): Contains intent detection, prompt building, response generation
- src/services/conversation-analyzer.service.ts: Analyzes conversation patterns
- src/services/personality-analyzer.service.ts: Analyzes user personality

Return ONLY valid JSON:
{
  "fix": "Specific description of what to change (be precise, include line numbers if possible)",
  "confidence": "high|medium|low",
  "filesAffected": ["list of files that need changes"],
  "codeChange": "Brief example of the code change needed"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a code analysis expert. Provide specific, actionable fixes. Return valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : {
      fix: 'Manual review needed',
      confidence: 'low',
      filesAffected: [],
      codeChange: ''
    };
  } catch (error) {
    console.error('Fix suggestion error:', error);
    return {
      fix: 'Manual review needed',
      confidence: 'low',
      filesAffected: [],
      codeChange: ''
    };
  }
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(patterns: FailurePattern[]): any[] {
  const recommendations = patterns
    .filter(p => p.confidence === 'high' || p.confidence === 'medium')
    .map((pattern, idx) => ({
      priority: idx + 1,
      issue: pattern.issue,
      impact: `Affects ${pattern.frequency} tests across ${pattern.affectedCategories.length} categories`,
      categories: pattern.affectedCategories,
      suggestedFix: pattern.suggestedFix,
      filesAffected: pattern.filesAffected,
      confidence: pattern.confidence,
      exampleInput: pattern.examples[0]?.input,
      exampleBadResponse: pattern.examples[0]?.response
    }));

  return recommendations;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║        Pattern Analyzer - GPT-4 Powered           ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  // Load evaluation results
  const resultsPath = path.join(__dirname, '..', 'test', 'evaluation-results.json');
  if (!fs.existsSync(resultsPath)) {
    console.error('❌ No evaluation results found. Run evaluate-quality.ts first.');
    process.exit(1);
  }

  const evaluationData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  const failedTests = evaluationData.report.failedTests;

  if (failedTests.length === 0) {
    console.log('\n✅ No failures to analyze! Agent is working perfectly.');
    return;
  }

  // Analyze patterns
  const patterns = await analyzeFailures(failedTests);
  
  // Generate recommendations
  const recommendations = generateRecommendations(patterns);

  // Display results
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║              PATTERN ANALYSIS RESULTS              ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  console.log(`Found ${patterns.length} distinct failure patterns\n`);

  recommendations.forEach((rec, idx) => {
    console.log(`\n${idx + 1}. ${rec.issue}`);
    console.log(`   Impact: ${rec.impact}`);
    console.log(`   Confidence: ${rec.confidence.toUpperCase()}`);
    console.log(`   Affected categories: ${rec.categories.join(', ')}`);
    console.log(`   Files to change: ${rec.filesAffected.join(', ')}`);
    console.log(`   Suggested fix:`);
    console.log(`   ${rec.suggestedFix}`);
    console.log(`   Example failure:`);
    console.log(`     Input: "${rec.exampleInput?.substring(0, 60)}..."`);
  });

  // Save analysis
  const outputPath = path.join(__dirname, '..', 'test', 'pattern-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalFailures: failedTests.length,
    patterns,
    recommendations
  }, null, 2));

  console.log(`\n\n💾 Analysis saved to: ${outputPath}`);
  
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║  Next: Review recommendations and approve fixes   ║');
  console.log('╚═══════════════════════════════════════════════════╝');
}

if (require.main === module) {
  main().catch(console.error);
}

export { analyzeFailures, generateRecommendations };

