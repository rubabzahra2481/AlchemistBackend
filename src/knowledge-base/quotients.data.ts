export interface QuotientData {
  id: string;
  name: string;
  fullName: string;
  description: string;
  keyAspects: string[];
  characteristics: {
    high: string[];
    low: string[];
  };
  developmentStrategies: string[];
  assessmentIndicators: string[];
  relatedQuotients: string[];
  importanceInLife: string;
}

export const QUOTIENTS_KNOWLEDGE_BASE: QuotientData[] = [
  {
    id: 'iq',
    name: 'IQ',
    fullName: 'Intelligence Quotient',
    description:
      'Measures cognitive abilities including logical reasoning, problem-solving, abstract thinking, and learning capacity. IQ represents the ability to understand complex ideas, adapt effectively to the environment, learn from experience, and engage in various forms of reasoning.',
    keyAspects: [
      'Logical-mathematical reasoning',
      'Spatial visualization',
      'Verbal comprehension',
      'Working memory',
      'Processing speed',
      'Pattern recognition',
      'Abstract thinking',
    ],
    characteristics: {
      high: [
        'Quick learner, grasps complex concepts easily',
        'Strong analytical and problem-solving skills',
        'Excellent memory and recall abilities',
        'Enjoys intellectual challenges and puzzles',
        'Can see patterns and connections others miss',
        'Strong verbal and written communication',
        'Adapts quickly to new situations',
      ],
      low: [
        'May struggle with abstract concepts',
        'Takes longer to learn new information',
        'Difficulty with complex problem-solving',
        'Prefers concrete over abstract thinking',
        'May need more repetition to retain information',
      ],
    },
    developmentStrategies: [
      'Engage in regular reading and learning new subjects',
      'Practice logic puzzles, chess, and strategy games',
      'Learn a new language or musical instrument',
      'Engage in critical thinking exercises',
      'Challenge yourself with complex problems',
      'Practice memory techniques and mnemonics',
      'Maintain physical health (exercise improves cognitive function)',
    ],
    assessmentIndicators: [
      'Speed of understanding new concepts',
      'Quality of logical reasoning in conversation',
      'Vocabulary richness and precision',
      'Ability to make connections between ideas',
      'Problem-solving approach complexity',
      'Memory recall in discussions',
    ],
    relatedQuotients: ['eq', 'cq', 'lq'],
    importanceInLife:
      "IQ is crucial for academic success, career advancement in technical fields, and solving complex problems. However, it's just one aspect of overall intelligence and success.",
  },
  {
    id: 'eq',
    name: 'EQ',
    fullName: 'Emotional Quotient (Emotional Intelligence)',
    description:
      'The ability to recognize, understand, manage, and influence emotions in yourself and others. EQ encompasses self-awareness, self-regulation, motivation, empathy, and social skills.',
    keyAspects: [
      'Self-awareness (recognizing own emotions)',
      'Self-regulation (managing emotions)',
      'Internal motivation',
      "Empathy (understanding others' emotions)",
      'Social skills (managing relationships)',
      'Emotional resilience',
      'Conflict resolution',
    ],
    characteristics: {
      high: [
        'Strong self-awareness and emotional understanding',
        'Excellent at reading social cues and body language',
        'Handles stress and pressure gracefully',
        'Builds strong, meaningful relationships',
        'Shows genuine empathy and compassion',
        'Adapts communication style to different people',
        'Resolves conflicts effectively',
        'Motivates and inspires others',
      ],
      low: [
        'Difficulty recognizing own emotional states',
        "Struggles to understand others' feelings",
        'May be seen as insensitive or abrasive',
        'Poor stress management',
        'Difficulty maintaining relationships',
        'Reacts impulsively to emotional situations',
        'Struggles with giving/receiving feedback',
      ],
    },
    developmentStrategies: [
      'Practice mindfulness and self-reflection daily',
      'Keep an emotion journal to track feelings',
      'Actively listen without judgment',
      "Practice empathy by considering others' perspectives",
      'Seek feedback on your interpersonal interactions',
      'Learn and practice stress management techniques',
      'Read fiction to understand diverse emotional experiences',
      'Engage in therapy or coaching for deeper self-awareness',
    ],
    assessmentIndicators: [
      'Use of emotional vocabulary in conversation',
      'Awareness of own emotional triggers',
      'Ability to discuss feelings openly',
      'Response to hypothetical emotional scenarios',
      'Level of empathy shown toward others',
      'Conflict handling approach',
      'Self-regulation during stressful topics',
    ],
    relatedQuotients: ['sq', 'aq', 'rq'],
    importanceInLife:
      'EQ is critical for leadership, relationships, mental health, and overall life satisfaction. Studies show EQ often predicts success better than IQ in many life domains.',
  },
  {
    id: 'aq',
    name: 'AQ',
    fullName: 'Adversity Quotient',
    description:
      'Measures the ability to handle adversity, overcome challenges, and bounce back from setbacks. AQ determines how well you respond to difficulties and your resilience in the face of obstacles.',
    keyAspects: [
      'Control (perceived ability to influence outcomes)',
      'Ownership (taking responsibility)',
      'Reach (limiting the impact of adversity)',
      'Endurance (seeing setbacks as temporary)',
      'Resilience and grit',
      'Stress tolerance',
      'Growth mindset',
    ],
    characteristics: {
      high: [
        'Bounces back quickly from failures',
        'Views challenges as opportunities',
        'Maintains optimism during difficult times',
        'Takes ownership of problems and solutions',
        'Perseveres despite obstacles',
        'Learns from failures and adapts',
        'Stays calm under pressure',
        'Helps others through difficult times',
      ],
      low: [
        'Easily discouraged by setbacks',
        'Tends to give up when faced with obstacles',
        'Blames external factors for problems',
        'Sees failures as permanent',
        'Avoids challenging situations',
        'High stress reactivity',
        'Difficulty recovering from disappointments',
      ],
    },
    developmentStrategies: [
      'Reframe failures as learning opportunities',
      'Practice facing small challenges regularly',
      'Develop a growth mindset through affirmations',
      'Build a support network for tough times',
      'Study biographies of resilient people',
      'Practice stress management and self-care',
      'Set challenging but achievable goals',
      "Reflect on past adversities you've overcome",
      'Develop problem-solving skills systematically',
    ],
    assessmentIndicators: [
      'Response to discussing past failures',
      'Attitude toward current challenges',
      'Language patterns (victim vs. victor mentality)',
      'Willingness to take on difficult tasks',
      'Recovery time from setbacks',
      'Attribution style (internal vs. external)',
      'Level of perseverance in goals',
    ],
    relatedQuotients: ['eq', 'mq', 'gq'],
    importanceInLife:
      "AQ is essential for long-term success, career advancement, entrepreneurship, and mental health. It determines whether you climb, camp, or quit when facing life's mountains.",
  },
  {
    id: 'sq',
    name: 'SQ',
    fullName: 'Social Quotient',
    description:
      'The ability to build and maintain relationships, navigate social situations, and work effectively with others. SQ encompasses social awareness, communication skills, and the ability to influence and connect with people.',
    keyAspects: [
      'Social awareness and perception',
      'Communication effectiveness',
      'Relationship building',
      'Influence and persuasion',
      'Collaboration and teamwork',
      'Cultural sensitivity',
      'Networking abilities',
    ],
    characteristics: {
      high: [
        'Makes friends easily and maintains relationships',
        'Excellent communicator in various contexts',
        'Reads social situations accurately',
        'Builds diverse networks naturally',
        'Influences others positively',
        'Works well in teams',
        'Handles social conflicts gracefully',
        'Adapts to different social environments',
      ],
      low: [
        'Struggles in social situations',
        'Difficulty making or keeping friends',
        'Misreads social cues',
        'Prefers solitary activities',
        'Awkward in group settings',
        'Limited social network',
        'Difficulty with small talk or networking',
      ],
    },
    developmentStrategies: [
      'Practice active listening in all conversations',
      'Join clubs or groups aligned with your interests',
      'Volunteer for team projects or community service',
      'Study body language and non-verbal communication',
      'Practice small talk and conversation starters',
      'Attend networking events regularly',
      'Seek mentorship in social skills',
      'Read books on influence and persuasion',
      'Practice empathy and perspective-taking',
    ],
    assessmentIndicators: [
      'Comfort level in social discussions',
      'Quality of questions asked',
      'Ability to build rapport quickly',
      'References to social connections',
      'Communication clarity and engagement',
      'Responsiveness to social cues',
      'Collaborative language usage',
    ],
    relatedQuotients: ['eq', 'cq', 'lq'],
    importanceInLife:
      'SQ is vital for career success, leadership, personal relationships, and overall happiness. Most opportunities in life come through relationships and social connections.',
  },
  {
    id: 'cq',
    name: 'CQ',
    fullName: 'Creativity Quotient',
    description:
      'Measures creative thinking ability, innovation, originality, and the capacity to generate novel ideas and solutions. CQ encompasses divergent thinking, imagination, and the ability to see things from unique perspectives.',
    keyAspects: [
      'Divergent thinking (generating multiple solutions)',
      'Originality and novelty',
      'Imagination and visualization',
      'Artistic expression',
      'Innovation and invention',
      'Flexibility in thinking',
      'Risk-taking in ideas',
    ],
    characteristics: {
      high: [
        'Generates unique and original ideas',
        'Thinks outside conventional boundaries',
        'Enjoys brainstorming and ideation',
        "Sees connections others don't",
        'Comfortable with ambiguity',
        'Experiments with new approaches',
        'Expresses ideas in creative ways',
        'Questions status quo regularly',
      ],
      low: [
        'Prefers established methods and routines',
        'Struggles with open-ended problems',
        'Uncomfortable with ambiguity',
        'Follows conventional thinking',
        'Difficulty generating novel ideas',
        'Prefers structured environments',
        'Risk-averse in thinking',
      ],
    },
    developmentStrategies: [
      'Practice brainstorming without judgment',
      'Engage in creative hobbies (art, music, writing)',
      'Expose yourself to diverse experiences and cultures',
      'Challenge assumptions regularly',
      'Practice lateral thinking puzzles',
      'Keep an idea journal',
      'Collaborate with creative people',
      'Try new experiences outside your comfort zone',
      'Study creative problem-solving techniques',
    ],
    assessmentIndicators: [
      'Uniqueness of ideas shared',
      'Approach to problem-solving',
      'Use of metaphors and analogies',
      'Openness to unconventional solutions',
      'Frequency of "what if" questions',
      'Comfort with ambiguous scenarios',
      'References to creative pursuits',
    ],
    relatedQuotients: ['iq', 'aq', 'vq'],
    importanceInLife:
      "CQ is increasingly important in the modern economy for innovation, entrepreneurship, problem-solving, and adapting to rapid change. It's essential for staying relevant in evolving fields.",
  },
  {
    id: 'mq',
    name: 'MQ',
    fullName: 'Moral Quotient',
    description:
      'The ability to distinguish right from wrong, make ethical decisions, and act with integrity. MQ encompasses moral reasoning, ethical judgment, values alignment, and the courage to act on principles.',
    keyAspects: [
      'Ethical reasoning and judgment',
      'Integrity and honesty',
      'Fairness and justice orientation',
      'Compassion and care for others',
      'Responsibility and accountability',
      'Moral courage',
      'Values consistency',
    ],
    characteristics: {
      high: [
        'Strong sense of right and wrong',
        'Acts with integrity even when difficult',
        'Considers ethical implications of decisions',
        'Stands up for principles and values',
        'Treats others fairly and with respect',
        'Takes responsibility for actions',
        'Shows moral courage in difficult situations',
        'Consistent between words and actions',
      ],
      low: [
        'Flexible ethics based on convenience',
        'Difficulty with moral dilemmas',
        'May prioritize self-interest over ethics',
        'Inconsistent values application',
        'Avoids taking moral stands',
        'Rationalizes unethical behavior',
        'Limited consideration of impact on others',
      ],
    },
    developmentStrategies: [
      'Reflect on your core values regularly',
      'Study ethical philosophy and moral reasoning',
      'Discuss moral dilemmas with others',
      'Practice making values-based decisions',
      'Seek feedback on your ethical behavior',
      'Read about moral exemplars and leaders',
      'Volunteer for causes aligned with your values',
      'Practice transparency and honesty',
      'Consider long-term consequences of actions',
    ],
    assessmentIndicators: [
      'Discussion of values and principles',
      'Response to ethical dilemmas',
      'Consistency in stated beliefs',
      'Consideration of others in decisions',
      'Accountability language',
      'References to fairness and justice',
      'Willingness to discuss moral issues',
    ],
    relatedQuotients: ['eq', 'sq', 'aq'],
    importanceInLife:
      "MQ is fundamental for building trust, maintaining relationships, leadership effectiveness, and creating a meaningful life. It's the foundation of character and reputation.",
  },
  {
    id: 'lq',
    name: 'LQ',
    fullName: 'Learning Quotient',
    description:
      'The ability and desire to learn continuously, unlearn outdated knowledge, and relearn new skills. LQ measures learning agility, curiosity, adaptability, and the capacity to apply learning in new contexts.',
    keyAspects: [
      'Learning agility and speed',
      'Curiosity and inquisitiveness',
      'Adaptability to new information',
      'Transfer of learning across contexts',
      'Unlearning outdated knowledge',
      'Meta-learning (learning how to learn)',
      'Growth mindset',
    ],
    characteristics: {
      high: [
        'Constantly curious and asking questions',
        'Learns new skills quickly',
        'Seeks out learning opportunities',
        'Adapts to new information easily',
        'Applies learning across different domains',
        'Comfortable with being a beginner',
        'Reads and researches extensively',
        'Experiments with new approaches',
      ],
      low: [
        'Resistant to new information',
        'Prefers familiar knowledge and skills',
        'Avoids learning challenges',
        'Slow to adapt to change',
        'Fixed mindset about abilities',
        'Limited curiosity',
        'Struggles to apply learning in new contexts',
      ],
    },
    developmentStrategies: [
      'Commit to learning something new monthly',
      'Practice deliberate learning techniques',
      'Teach others what you learn (Feynman technique)',
      "Embrace the beginner's mindset",
      'Read widely across different subjects',
      'Take online courses in diverse topics',
      'Join learning communities',
      'Reflect on your learning process',
      'Challenge yourself with difficult subjects',
      'Practice spaced repetition and active recall',
    ],
    assessmentIndicators: [
      'Frequency of questions asked',
      'References to recent learning',
      'Openness to new information',
      'Curiosity about various topics',
      'Willingness to admit knowledge gaps',
      'Discussion of learning methods',
      'Adaptability in conversation',
    ],
    relatedQuotients: ['iq', 'aq', 'cq'],
    importanceInLife:
      'LQ is critical in the rapidly changing modern world. It determines career longevity, adaptability, and the ability to stay relevant as industries and technologies evolve.',
  },
  {
    id: 'vq',
    name: 'VQ',
    fullName: 'Vision Quotient',
    description:
      'The ability to create, articulate, and pursue a compelling vision for the future. VQ encompasses strategic thinking, long-term planning, goal-setting, and the capacity to inspire others with your vision.',
    keyAspects: [
      'Strategic thinking and planning',
      'Future orientation',
      'Goal clarity and articulation',
      'Inspirational communication',
      'Pattern recognition for trends',
      'Systems thinking',
      'Purposeful direction',
    ],
    characteristics: {
      high: [
        'Clear sense of direction and purpose',
        'Thinks strategically about the future',
        'Sets ambitious long-term goals',
        'Inspires others with their vision',
        "Sees possibilities others don't",
        'Plans systematically for the future',
        'Aligns actions with long-term vision',
        'Anticipates future trends and changes',
      ],
      low: [
        'Lives day-to-day without clear direction',
        'Difficulty setting long-term goals',
        'Reactive rather than proactive',
        'Struggles with strategic planning',
        'Limited future orientation',
        'Difficulty articulating aspirations',
        'Short-term focus only',
      ],
    },
    developmentStrategies: [
      'Create a personal vision statement',
      'Practice strategic planning exercises',
      'Set 1-year, 5-year, and 10-year goals',
      'Study visionary leaders and their methods',
      'Regularly visualize your ideal future',
      'Learn systems thinking and trend analysis',
      'Join mastermind groups for vision clarity',
      'Practice articulating your vision to others',
      'Align daily actions with long-term vision',
    ],
    assessmentIndicators: [
      'Clarity about future goals',
      'Long-term vs. short-term focus',
      'Strategic thinking in responses',
      'Purposefulness in life direction',
      'Ability to articulate aspirations',
      'Future-oriented language',
      'Goal-setting sophistication',
    ],
    relatedQuotients: ['iq', 'cq', 'lq'],
    importanceInLife:
      'VQ is essential for leadership, entrepreneurship, career success, and creating a meaningful life. It provides direction, motivation, and the ability to inspire others.',
  },
  {
    id: 'rq',
    name: 'RQ',
    fullName: 'Resilience Quotient',
    description:
      'The capacity to recover quickly from difficulties, adapt to change, and maintain mental well-being under stress. RQ encompasses psychological flexibility, stress management, and the ability to thrive despite challenges.',
    keyAspects: [
      'Psychological flexibility',
      'Stress management',
      'Recovery speed from setbacks',
      'Adaptability to change',
      'Mental toughness',
      'Optimism and hope',
      'Self-care practices',
    ],
    characteristics: {
      high: [
        'Recovers quickly from setbacks',
        'Maintains composure under stress',
        'Adapts well to change',
        'Maintains positive outlook',
        'Practices effective self-care',
        'Seeks support when needed',
        'Learns from difficult experiences',
        'Maintains balance in life',
      ],
      low: [
        'Prolonged recovery from difficulties',
        'Overwhelmed by stress easily',
        'Rigid in face of change',
        'Prone to burnout',
        'Neglects self-care',
        'Isolates during difficult times',
        'Difficulty maintaining perspective',
      ],
    },
    developmentStrategies: [
      'Develop a consistent self-care routine',
      'Practice stress management techniques daily',
      'Build a strong support network',
      'Engage in regular physical exercise',
      'Practice mindfulness and meditation',
      'Maintain work-life balance',
      'Develop healthy coping mechanisms',
      'Seek professional help when needed',
      'Practice gratitude and positive psychology',
    ],
    assessmentIndicators: [
      'Stress level in conversation',
      'Self-care practices mentioned',
      'Response to discussing challenges',
      'Balance in life priorities',
      'Support system references',
      'Coping mechanisms discussed',
      'Overall mental well-being indicators',
    ],
    relatedQuotients: ['eq', 'aq', 'mq'],
    importanceInLife:
      'RQ is crucial for mental health, longevity, career sustainability, and overall quality of life. It determines how well you handle the inevitable stresses of modern life.',
  },
  {
    id: 'pq',
    name: 'PQ',
    fullName: 'Passion Quotient',
    description:
      'The level of enthusiasm, drive, and intrinsic motivation you bring to your pursuits. PQ measures how deeply you care about your work, interests, and life activities, and your ability to sustain engagement over time.',
    keyAspects: [
      'Intrinsic motivation',
      'Enthusiasm and energy',
      'Deep engagement (flow states)',
      'Persistence in interests',
      'Purpose alignment',
      'Joyful pursuit',
      'Contagious inspiration',
    ],
    characteristics: {
      high: [
        'Deeply engaged in their pursuits',
        'High energy and enthusiasm',
        'Intrinsically motivated',
        'Experiences flow states regularly',
        'Inspires others with their passion',
        'Persists despite obstacles',
        'Finds meaning in their work',
        'Talks excitedly about interests',
      ],
      low: [
        'Goes through the motions',
        'Lacks enthusiasm for activities',
        'Primarily extrinsically motivated',
        'Difficulty finding meaning',
        'Low energy and engagement',
        'Easily bored or distracted',
        'Seeks external validation',
      ],
    },
    developmentStrategies: [
      'Explore different interests and hobbies',
      'Identify your core values and align activities',
      'Seek work that aligns with your strengths',
      'Connect daily tasks to larger purpose',
      'Surround yourself with passionate people',
      'Practice gratitude for opportunities',
      'Take breaks to prevent burnout',
      'Experiment with new experiences',
      'Reflect on what brings you joy',
    ],
    assessmentIndicators: [
      'Energy level in conversation',
      'Enthusiasm when discussing interests',
      'Intrinsic vs. extrinsic motivation',
      'Depth of engagement in activities',
      'Purpose and meaning references',
      'Flow state experiences',
      'Persistence in pursuits',
    ],
    relatedQuotients: ['vq', 'aq', 'lq'],
    importanceInLife:
      'PQ drives sustained effort, career satisfaction, and life fulfillment. Passionate people are more successful, healthier, and happier overall.',
  },
];

export function getQuotientById(id: string): QuotientData | undefined {
  return QUOTIENTS_KNOWLEDGE_BASE.find((q) => q.id === id);
}

export function getAllQuotients(): QuotientData[] {
  return QUOTIENTS_KNOWLEDGE_BASE;
}

export function searchQuotients(query: string): QuotientData[] {
  const lowerQuery = query.toLowerCase();
  return QUOTIENTS_KNOWLEDGE_BASE.filter(
    (q) =>
      q.name.toLowerCase().includes(lowerQuery) ||
      q.fullName.toLowerCase().includes(lowerQuery) ||
      q.description.toLowerCase().includes(lowerQuery) ||
      q.keyAspects.some((aspect) => aspect.toLowerCase().includes(lowerQuery)),
  );
}
