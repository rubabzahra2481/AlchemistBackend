import OpenAI from 'openai';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const AGENT_URL = 'http://localhost:3000/chat';

interface TestCase {
  category: string;
  input: string;
  expectedBehavior?: string;
  shouldContain?: string[];
  shouldNOTcontain?: string[];
  maxLength?: number;
  mustContain?: string[];
  mustNOTcontain?: string[];
  description?: string;
}

interface EvaluationResult {
  testCase: TestCase;
  agentResponse: string;
  scores: {
    naturalness: number;
    helpfulness: number;
    specificity: number;
    appropriateness: number;
    conciseness: number;
  };
  overallScore: number;
  passed: boolean;
  issues: string[];
  llmJudgment: string;
}

/**
 * Send message to agent and get response
 */
async function queryAgent(message: string, sessionId?: string): Promise<string> {
  try {
    const payload: any = { message };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    
    const response = await axios.post(AGENT_URL, payload);
    return response.data.response;
  } catch (error) {
    // Log the full error for debugging
    if (error.response) {
      console.error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Agent query failed: ${error.message}`);
  }
}

/**
 * Use GPT-4 to judge response quality
 */
async function judgeResponse(
  userMessage: string,
  agentResponse: string,
  expectedBehavior: string
): Promise<any> {
  const judgePrompt = `You are evaluating a mental health/advice agent's response.

USER MESSAGE: "${userMessage}"
AGENT RESPONSE: "${agentResponse}"
EXPECTED BEHAVIOR: ${expectedBehavior}

Rate the response on a scale of 1-10 for each criterion:

1. NATURALNESS: Does it sound human and conversational (not robotic)?
2. HELPFULNESS: Does it actually help the user with their specific situation?
3. SPECIFICITY: Is the advice specific and actionable (not generic platitudes)?
4. APPROPRIATENESS: Is the tone and content appropriate for the user's situation?
5. CONCISENESS: Is it brief and to the point (not verbose)?

Also identify any CRITICAL ISSUES:
- Uses psychology jargon (scores, percentiles, DASS, RSE, Big Five, quotients, traits)
- Parses emotions/actions as names (e.g., "Nice to meet you, Feeling Stressed!")
- Asks "Have you tried/considered/identified" when user wants direct help
- Generic business advice (create business plan, reach out to mentors, market research)
- Too long (over 200 words)
- Doesn't address the user's actual question

Return ONLY valid JSON:
{
  "scores": {
    "naturalness": 1-10,
    "helpfulness": 1-10,
    "specificity": 1-10,
    "appropriateness": 1-10,
    "conciseness": 1-10
  },
  "criticalIssues": ["list of issues found"],
  "judgment": "Brief explanation of why you gave these scores",
  "wouldHelpRealUser": true/false
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a strict quality evaluator for AI agents. Be critical but fair. Return valid JSON only.'
        },
        {
          role: 'user',
          content: judgePrompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3 // Low temp for consistent evaluation
    });

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error('Judge error:', error);
    return null;
  }
}

/**
 * Check if response passes baseline requirements
 */
function checkBaseline(testCase: TestCase, response: string): string[] {
  const issues: string[] = [];

  // Check mustContain
  if (testCase.mustContain) {
    testCase.mustContain.forEach(phrase => {
      if (!response.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(`Missing required phrase: "${phrase}"`);
      }
    });
  }

  // Check shouldContain
  if (testCase.shouldContain) {
    testCase.shouldContain.forEach(phrase => {
      if (!response.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(`Should contain: "${phrase}"`);
      }
    });
  }

  // Check mustNOTcontain (CRITICAL)
  if (testCase.mustNOTcontain) {
    testCase.mustNOTcontain.forEach(phrase => {
      if (response.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(`CRITICAL: Contains banned phrase: "${phrase}"`);
      }
    });
  }

  // Check shouldNOTcontain
  if (testCase.shouldNOTcontain) {
    testCase.shouldNOTcontain.forEach(phrase => {
      if (response.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(`Contains unwanted phrase: "${phrase}"`);
      }
    });
  }

  // Check length
  if (testCase.maxLength && response.length > testCase.maxLength) {
    issues.push(`Too long: ${response.length} chars (max: ${testCase.maxLength})`);
  }

  return issues;
}

/**
 * Evaluate agent against test cases
 */
async function evaluateAgent(testCases: TestCase[]): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];
  const sessionId = `eval-${Date.now()}`;

  console.log(`\n🔄 Evaluating agent against ${testCases.length} test cases...\n`);

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`[${i + 1}/${testCases.length}] Testing: ${testCase.category} - "${testCase.input.substring(0, 50)}..."`);

    try {
      // Get agent response (don't send sessionId to avoid validation issues)
      const agentResponse = await queryAgent(testCase.input);
      
      // Check baseline requirements
      const baselineIssues = checkBaseline(testCase, agentResponse);
      
      // Get GPT-4 judgment
      let scores = { naturalness: 5, helpfulness: 5, specificity: 5, appropriateness: 5, conciseness: 5 };
      let llmJudgment = '';
      let criticalIssues: string[] = [];

      if (testCase.expectedBehavior) {
        const judgment = await judgeResponse(
          testCase.input,
          agentResponse,
          testCase.expectedBehavior
        );

        if (judgment) {
          scores = judgment.scores;
          llmJudgment = judgment.judgment;
          criticalIssues = judgment.criticalIssues || [];
        }

        // Wait to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const allIssues = [...baselineIssues, ...criticalIssues];
      const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
      const passed = allIssues.length === 0 && overallScore >= 7.0;

      const result: EvaluationResult = {
        testCase,
        agentResponse,
        scores,
        overallScore,
        passed,
        issues: allIssues,
        llmJudgment
      };

      results.push(result);

      // Show result
      const status = passed ? '✅ PASS' : '❌ FAIL';
      const color = passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}${status}\x1b[0m Score: ${overallScore.toFixed(1)}/10`);
      if (!passed) {
        console.log(`  Issues: ${allIssues.join(', ')}`);
      }
      console.log();

    } catch (error) {
      console.error(`❌ Error testing "${testCase.input}": ${error.message}\n`);
    }
  }

  return results;
}

/**
 * Generate comprehensive report
 */
function generateReport(results: EvaluationResult[]): any {
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  const categoryBreakdown: any = {};
  const issueBreakdown: any = {};

  results.forEach(r => {
    const cat = r.testCase.category;
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { total: 0, passed: 0, avgScore: 0, scores: [] };
    }
    categoryBreakdown[cat].total++;
    if (r.passed) categoryBreakdown[cat].passed++;
    categoryBreakdown[cat].scores.push(r.overallScore);

    r.issues.forEach(issue => {
      issueBreakdown[issue] = (issueBreakdown[issue] || 0) + 1;
    });
  });

  // Calculate averages
  Object.keys(categoryBreakdown).forEach(cat => {
    const scores = categoryBreakdown[cat].scores;
    categoryBreakdown[cat].avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    categoryBreakdown[cat].passRate = (categoryBreakdown[cat].passed / categoryBreakdown[cat].total * 100).toFixed(1);
  });

  // Sort issues by frequency
  const topIssues = Object.entries(issueBreakdown)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  const overallAvgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;

  return {
    summary: {
      totalTests: results.length,
      passed: passed.length,
      failed: failed.length,
      passRate: (passed.length / results.length * 100).toFixed(1) + '%',
      overallScore: overallAvgScore.toFixed(1) + '/10'
    },
    categoryBreakdown,
    topIssues,
    failedTests: failed.map(r => ({
      category: r.testCase.category,
      input: r.testCase.input,
      response: r.agentResponse,
      issues: r.issues,
      score: r.overallScore
    }))
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║     Agent Quality Evaluator - GPT-4 Judge         ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  // Load baseline tests
  const baselinePath = path.join(__dirname, '..', 'test', 'baseline-behaviors.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  
  console.log(`\n📋 Loaded ${baseline.tests.length} baseline tests`);

  // Load generated tests (if available)
  let generatedTests: TestCase[] = [];
  const generatedPath = path.join(__dirname, '..', 'test', 'generated-test-cases.json');
  if (fs.existsSync(generatedPath)) {
    const generated = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
    generatedTests = generated.testCases || [];
    console.log(`📋 Loaded ${generatedTests.length} generated tests`);
  }

  const allTests = [...baseline.tests, ...generatedTests];
  console.log(`\n🎯 Total tests to run: ${allTests.length}`);

  // Run evaluation
  const results = await evaluateAgent(allTests);

  // Generate report
  const report = generateReport(results);

  // Display summary
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║                  EVALUATION RESULTS                ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  console.log('SUMMARY:');
  console.log(`  Total Tests: ${report.summary.totalTests}`);
  console.log(`  Passed: ${report.summary.passed} ✅`);
  console.log(`  Failed: ${report.summary.failed} ❌`);
  console.log(`  Pass Rate: ${report.summary.passRate}`);
  console.log(`  Overall Score: ${report.summary.overallScore}`);

  console.log('\nBY CATEGORY:');
  Object.entries(report.categoryBreakdown).forEach(([cat, stats]: [string, any]) => {
    console.log(`  ${cat}:`);
    console.log(`    Pass Rate: ${stats.passRate}%`);
    console.log(`    Avg Score: ${stats.avgScore.toFixed(1)}/10`);
    console.log(`    Tests: ${stats.passed}/${stats.total} passed`);
  });

  console.log('\nTOP ISSUES:');
  report.topIssues.forEach((item: any, idx: number) => {
    console.log(`  ${idx + 1}. ${item.issue} (${item.count} occurrences)`);
  });

  // Save results
  const outputPath = path.join(__dirname, '..', 'test', 'evaluation-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    report,
    detailedResults: results
  }, null, 2));

  console.log(`\n💾 Detailed results saved to: ${outputPath}`);

  // Quality assessment
  const score = parseFloat(report.summary.overallScore);
  console.log('\n╔═══════════════════════════════════════════════════╗');
  if (score >= 9.0) {
    console.log('║  🌟 EXCELLENT - Production Ready!                 ║');
  } else if (score >= 8.0) {
    console.log('║  ✅ VERY GOOD - Minor improvements needed         ║');
  } else if (score >= 7.0) {
    console.log('║  👍 GOOD - Some improvements recommended          ║');
  } else if (score >= 6.0) {
    console.log('║  ⚠️  FAIR - Significant improvements needed       ║');
  } else {
    console.log('║  ❌ NEEDS WORK - Major issues to address          ║');
  }
  console.log('╚═══════════════════════════════════════════════════╝');
}

if (require.main === module) {
  main().catch(console.error);
}

export { evaluateAgent, judgeResponse };

