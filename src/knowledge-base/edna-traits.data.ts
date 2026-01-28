/**
 * E-DNA Trait Definitions
 * 
 * This file contains hardcoded character sketches for each E-DNA result type.
 * When the API returns a result like "Alchemist", we look up its definition here
 * and fill it into the E-DNA profile template.
 * 
 * Format: Each trait is written as "This person is..." to make it easy for
 * the advice LLM to understand the user's personality.
 * 
 * NOTE: These are PLACEHOLDER definitions. Replace with actual business definitions.
 */

// ============================================
// LAYER 1: CORE TYPE (Architect vs Alchemist)
// ============================================
export const LAYER_1_CORE_TYPE: Record<string, {
  name: string;
  description: string;
  traits: string[];
  decisionStyle: string;
  strengthAreas: string[];
  blindSpots: string[];
}> = {
  'architect': {
    name: 'Architect',
    description: 'This person is an Architect. They approach life through logic, structure, and strategic thinking. They prefer to plan ahead and build systems that work efficiently.',
    traits: [
      'Thinks logically and analytically',
      'Prefers structure and organization',
      'Plans before acting',
      'Values efficiency and results',
      'Makes decisions based on data and facts',
    ],
    decisionStyle: 'This person makes decisions by analyzing options, weighing pros and cons, and choosing the most logical path forward.',
    strengthAreas: ['Strategic planning', 'Problem-solving', 'Building systems', 'Long-term thinking'],
    blindSpots: ['May overlook emotional factors', 'Can be rigid in approach', 'Might miss intuitive insights'],
  },
  'alchemist': {
    name: 'Alchemist',
    description: 'This person is an Alchemist. They approach life through intuition, emotion, and transformation. They prefer to feel their way through situations and are comfortable with change.',
    traits: [
      'Thinks intuitively and emotionally',
      'Comfortable with ambiguity and change',
      'Acts on feelings and hunches',
      'Values meaning and transformation',
      'Makes decisions based on gut instinct',
    ],
    decisionStyle: 'This person makes decisions by feeling into situations, trusting their intuition, and following what feels right.',
    strengthAreas: ['Reading people', 'Adapting to change', 'Creative thinking', 'Emotional intelligence'],
    blindSpots: ['May overlook practical details', 'Can be inconsistent', 'Might struggle with structure'],
  },
  'mixed': {
    name: 'Mixed',
    description: 'This person has a Mixed core type. They shift between emotional and logical processing unpredictably. Their decision-making mode can change within a single conversation.',
    traits: [
      'Shifts between logic and emotion',
      'Can adapt to different situations',
      'May switch modes mid-conversation',
      'Flexible in approach',
      'Still finding their primary compass',
    ],
    decisionStyle: 'This person makes decisions by switching between feeling and thinking, sometimes using logic first, sometimes emotion first, depending on context.',
    strengthAreas: ['Flexibility', 'Seeing multiple perspectives', 'Adaptability', 'Balanced approach when aligned'],
    blindSpots: ['May leave decisions unfinished', 'Can feel scattered', 'Might struggle with consistency'],
  },
};

// ============================================
// LAYER 2: SUBTYPE
// ============================================
export const LAYER_2_SUBTYPE: Record<string, {
  name: string;
  description: string;
  approach: string;
  strengths: string[];
  challenges: string[];
}> = {
  'master strategist': {
    name: 'Master Strategist',
    description: 'This person is a Master Strategist. They excel at seeing the big picture and planning several steps ahead.',
    approach: 'They approach challenges by mapping out all possibilities and choosing the optimal path.',
    strengths: ['Long-term vision', 'Anticipating obstacles', 'Resource allocation'],
    challenges: ['May overthink simple situations', 'Can delay action for more planning'],
  },
  'analytical thinker': {
    name: 'Analytical Thinker',
    description: 'This person is an Analytical Thinker. They break down complex problems into smaller parts to understand them better.',
    approach: 'They approach challenges by gathering data, analyzing patterns, and making evidence-based decisions.',
    strengths: ['Detailed analysis', 'Finding root causes', 'Data interpretation'],
    challenges: ['May get lost in details', 'Can struggle with ambiguous situations'],
  },
  'creative visionary': {
    name: 'Creative Visionary',
    description: 'This person is a Creative Visionary. They see possibilities others miss and imagine new ways of doing things.',
    approach: 'They approach challenges by thinking outside the box and envisioning innovative solutions.',
    strengths: ['Innovation', 'Inspiring others', 'Seeing potential'],
    challenges: ['May struggle with execution', 'Can be impractical at times'],
  },
  'empathic connector': {
    name: 'Empathic Connector',
    description: 'This person is an Empathic Connector. They naturally understand others and build meaningful relationships.',
    approach: 'They approach challenges by understanding the human element and building consensus.',
    strengths: ['Reading emotions', 'Building trust', 'Conflict resolution'],
    challenges: ['May prioritize harmony over truth', 'Can absorb others\' stress'],
  },
  // Add more subtypes as needed...
};

// ============================================
// LAYER 3: INTEGRATION LEVEL
// ============================================
export const LAYER_3_INTEGRATION: Record<string, {
  level: string;
  description: string;
  meaning: string;
  recommendation: string;
}> = {
  'low': {
    level: 'Low Integration',
    description: 'This person has low integration between their core type and subtype.',
    meaning: 'They may experience internal conflict between different aspects of their personality. Their natural tendencies might not align smoothly with their developed skills.',
    recommendation: 'Focus on recognizing when different parts of yourself are in conflict, and practice bridging logic and intuition.',
  },
  'medium': {
    level: 'Medium Integration',
    description: 'This person has medium integration between their core type and subtype.',
    meaning: 'They have a reasonable balance between different aspects of their personality. Sometimes they flow naturally, other times they need conscious effort to align.',
    recommendation: 'Continue developing self-awareness and notice when you\'re at your best versus when you feel fragmented.',
  },
  'high': {
    level: 'High Integration',
    description: 'This person has high integration between their core type and subtype.',
    meaning: 'They have achieved harmony between different aspects of their personality. Their strengths complement each other well.',
    recommendation: 'Leverage your integrated approach to help others who may be struggling with internal conflicts.',
  },
};

// ============================================
// LAYER 4: LEARNING/WORKING STYLE
// ============================================
export const LAYER_4_MODALITY: Record<string, string> = {
  'visual': 'This person learns best through seeing - diagrams, charts, images, and visual representations help them understand concepts.',
  'auditory': 'This person learns best through hearing - discussions, lectures, and verbal explanations help them understand concepts.',
  'kinesthetic': 'This person learns best through doing - hands-on practice, movement, and physical engagement help them understand concepts.',
  'reading/writing': 'This person learns best through text - reading documents and writing notes help them understand concepts.',
};

export const LAYER_4_APPROACH: Record<string, string> = {
  'sequential': 'This person prefers to learn step-by-step, building understanding from foundational concepts to complex ideas.',
  'global': 'This person prefers to see the big picture first, then fill in the details as needed.',
  'random': 'This person prefers to learn in a non-linear way, jumping between topics based on interest and relevance.',
};

export const LAYER_4_CONCEPT_PROCESSING: Record<string, string> = {
  'concrete': 'This person thinks in concrete, practical terms. They prefer real-world examples and tangible applications.',
  'abstract': 'This person thinks in abstract, theoretical terms. They enjoy exploring concepts and principles.',
};

export const LAYER_4_ENVIRONMENT: Record<string, string> = {
  'structured': 'This person works best in structured environments with clear rules, deadlines, and expectations.',
  'flexible': 'This person works best in flexible environments where they can adapt their approach as needed.',
  'adaptive': 'This person can work effectively in both structured and flexible environments depending on the task.',
};

export const LAYER_4_PACE: Record<string, string> = {
  'fast': 'This person prefers a fast pace, quick decisions, and rapid progress.',
  'slow': 'This person prefers a slower pace, taking time to think deeply and consider options.',
  'flexible': 'This person adapts their pace to the situation, speeding up or slowing down as needed.',
};

// ============================================
// LAYER 5: NEUROTYPE STATUS
// ============================================
export const LAYER_5_NEUROTYPE: Record<string, {
  status: string;
  description: string;
  strengths: string[];
  considerations: string[];
}> = {
  'neurotypical': {
    status: 'Neurotypical',
    description: 'This person processes information in a typical way. Their cognitive patterns align with conventional expectations.',
    strengths: ['Easy communication with most people', 'Comfortable in standard environments', 'Predictable responses'],
    considerations: ['May not understand neurodivergent perspectives naturally'],
  },
  'neurodivergent': {
    status: 'Neurodivergent',
    description: 'This person processes information differently. Their cognitive patterns may include unique strengths and challenges.',
    strengths: ['Unique perspective', 'Potential for specialized focus', 'Creative thinking'],
    considerations: ['May need accommodations in some environments', 'Communication style may differ'],
  },
  'traits-evident': {
    status: 'Traits Evident',
    description: 'This person shows some neurodivergent traits but doesn\'t fully fit either category.',
    strengths: ['Blend of typical and atypical processing', 'Versatile thinking'],
    considerations: ['May feel "in between" at times'],
  },
};

// ============================================
// LAYER 6: MINDSET, PERSONALITY, COMMUNICATION
// ============================================
export const LAYER_6_MINDSET: Record<string, string> = {
  'growth/abundance': 'This person has a growth mindset with abundance thinking. They believe abilities can be developed and there\'s enough success for everyone.',
  'fixed/scarcity': 'This person tends toward fixed mindset with scarcity thinking. They may believe abilities are set and resources are limited.',
  'mixed': 'This person has a mixed mindset, showing growth orientation in some areas and fixed beliefs in others.',
};

export const LAYER_6_PERSONALITY: Record<string, string> = {
  'confident & steady': 'This person is confident and steady. They maintain composure under pressure and trust in their abilities.',
  'anxious & reactive': 'This person tends toward anxiety and reactivity. They may respond quickly to perceived threats or changes.',
  'balanced': 'This person has a balanced personality, neither overly confident nor anxious.',
};

export const LAYER_6_COMMUNICATION: Record<string, string> = {
  'direct communicator': 'This person communicates directly. They say what they mean and prefer others to do the same.',
  'indirect communicator': 'This person communicates indirectly. They use hints, context, and diplomacy to convey messages.',
  'adaptive communicator': 'This person adapts their communication style to the situation and audience.',
};

// ============================================
// LAYER 7: CORE VALUES
// ============================================
export const LAYER_7_FAITH: Record<string, string> = {
  'self-reliant': 'This person is self-reliant when it comes to faith and meaning. They trust their own judgment and internal compass.',
  'externally-guided': 'This person looks to external sources for faith and meaning - religion, philosophy, or community.',
  'balanced': 'This person balances internal and external sources of faith and meaning.',
};

export const LAYER_7_CONTROL: Record<string, string> = {
  'in control': 'This person prefers to be in control of their circumstances. They take initiative and manage their environment.',
  'go with flow': 'This person prefers to go with the flow. They accept circumstances and adapt rather than control.',
  'situational': 'This person takes control when needed but can also let go when appropriate.',
};

export const LAYER_7_FAIRNESS: Record<string, string> = {
  'responsibility': 'This person values personal responsibility. They believe everyone should own their choices and outcomes.',
  'compassion': 'This person values compassion. They believe in supporting others regardless of circumstances.',
  'balanced': 'This person balances responsibility and compassion depending on the situation.',
};

export const LAYER_7_INTEGRITY: Record<string, string> = {
  'direct honesty': 'This person values direct honesty. They tell the truth even when it\'s uncomfortable.',
  'diplomatic honesty': 'This person values diplomatic honesty. They tell the truth but consider the impact on others.',
  'situational': 'This person adapts their honesty style to the situation and stakes involved.',
};

export const LAYER_7_GROWTH: Record<string, string> = {
  'growth focused': 'This person is growth focused. They actively seek improvement and new challenges.',
  'stability focused': 'This person is stability focused. They value consistency and reliability over constant change.',
  'balanced': 'This person balances growth and stability, knowing when to push and when to consolidate.',
};

export const LAYER_7_IMPACT: Record<string, string> = {
  'self-focused impact': 'This person focuses on personal impact. They prioritize their own growth and immediate circle.',
  'others-focused impact': 'This person focuses on impact for others. They prioritize helping and serving a broader community.',
  'balanced impact': 'This person balances self-focused and others-focused impact.',
};

// ============================================
// HELPER: Build full E-DNA profile from API results
// ============================================
export interface EdnaQuizResults {
  layer1: {
    coreType: string;
    strength: string;
    architectScore: number;
    alchemistScore: number;
  };
  layer2: {
    subtype: string;
    description?: string;
  };
  layer3: {
    integration: string;
    integrationPercent: number;
  };
  layer4: {
    modalityPreference: string;
    approach: string;
    conceptProcessing: string;
    workingEnvironment: string;
    pace: string;
  };
  layer5: {
    status: string;
    traits?: {
      ntScore: number;
      ndScore: number;
      teScore: number;
    };
  };
  layer6: {
    mindset: string;
    personality: string;
    communication: string;
  };
  layer7: {
    faithOrientation: string;
    controlOrientation: string;
    fairness: string;
    integrity: string;
    growth: string;
    impact: string;
  };
}

export interface EdnaProfileFull {
  userId: string;
  completedAt?: string;
  layers: {
    layer1: {
      title: string;
      coreType: string;
      strength: string;
      description: string;
      traits: string[];
      decisionStyle: string;
      strengthAreas: string[];
      blindSpots: string[];
    };
    layer2: {
      title: string;
      subtype: string;
      description: string;
      approach: string;
      strengths: string[];
      challenges: string[];
    };
    layer3: {
      title: string;
      level: string;
      integrationPercent: number;
      description: string;
      meaning: string;
      recommendation: string;
    };
    layer4: {
      title: string;
      modality: string;
      modalityDescription: string;
      approach: string;
      approachDescription: string;
      conceptProcessing: string;
      conceptDescription: string;
      environment: string;
      environmentDescription: string;
      pace: string;
      paceDescription: string;
    };
    layer5: {
      title: string;
      status: string;
      description: string;
      strengths: string[];
      considerations: string[];
    };
    layer6: {
      title: string;
      mindset: string;
      mindsetDescription: string;
      personality: string;
      personalityDescription: string;
      communication: string;
      communicationDescription: string;
    };
    layer7: {
      title: string;
      faithOrientation: string;
      faithDescription: string;
      controlOrientation: string;
      controlDescription: string;
      fairness: string;
      fairnessDescription: string;
      integrity: string;
      integrityDescription: string;
      growth: string;
      growthDescription: string;
      impact: string;
      impactDescription: string;
    };
  };
  characterSummary: string;
}

/**
 * Build a full E-DNA profile from quiz results
 */
export function buildEdnaProfile(userId: string, quizResults: EdnaQuizResults, completedAt?: string): EdnaProfileFull {
  // Layer 1
  const coreTypeKey = quizResults.layer1.coreType?.toLowerCase() || 'architect';
  const layer1Data = LAYER_1_CORE_TYPE[coreTypeKey] || LAYER_1_CORE_TYPE['architect'];
  
  // Layer 2
  const subtypeKey = quizResults.layer2.subtype?.toLowerCase() || 'master strategist';
  const layer2Data = LAYER_2_SUBTYPE[subtypeKey] || {
    name: quizResults.layer2.subtype || 'Unknown',
    description: quizResults.layer2.description || `This person is a ${quizResults.layer2.subtype}.`,
    approach: 'They have a unique approach to challenges.',
    strengths: ['Adaptable'],
    challenges: ['May vary'],
  };
  
  // Layer 3
  const integrationKey = quizResults.layer3.integration?.toLowerCase() || 'medium';
  const layer3Data = LAYER_3_INTEGRATION[integrationKey] || LAYER_3_INTEGRATION['medium'];
  
  // Layer 4
  const modalityKey = quizResults.layer4.modalityPreference?.toLowerCase() || 'visual';
  const approachKey = quizResults.layer4.approach?.toLowerCase() || 'sequential';
  const conceptKey = quizResults.layer4.conceptProcessing?.toLowerCase() || 'concrete';
  const envKey = quizResults.layer4.workingEnvironment?.toLowerCase() || 'adaptive';
  const paceKey = quizResults.layer4.pace?.toLowerCase() || 'flexible';
  
  // Layer 5
  const neurotypeLookup: Record<string, string> = {
    'neurotypical': 'neurotypical',
    'neurodivergent': 'neurodivergent',
    'traits evident': 'traits-evident',
    'traits-evident': 'traits-evident',
  };
  const neuroKey = neurotypeLookup[quizResults.layer5.status?.toLowerCase()] || 'neurotypical';
  const layer5Data = LAYER_5_NEUROTYPE[neuroKey] || LAYER_5_NEUROTYPE['neurotypical'];
  
  // Layer 6
  const mindsetKey = quizResults.layer6.mindset?.toLowerCase().replace(/\s+/g, '/') || 'growth/abundance';
  const personalityKey = quizResults.layer6.personality?.toLowerCase().replace(/\s+&\s+/g, ' & ') || 'balanced';
  const commKey = quizResults.layer6.communication?.toLowerCase() || 'adaptive communicator';
  
  // Layer 7
  const faithKey = quizResults.layer7.faithOrientation?.toLowerCase().replace(/-/g, '-') || 'balanced';
  const controlKey = quizResults.layer7.controlOrientation?.toLowerCase().replace(/\s+/g, ' ') || 'situational';
  const fairnessKey = quizResults.layer7.fairness?.toLowerCase() || 'balanced';
  const integrityKey = quizResults.layer7.integrity?.toLowerCase().replace(/\s+/g, ' ') || 'situational';
  const growthKey = quizResults.layer7.growth?.toLowerCase().replace(/\s+/g, ' ') || 'balanced';
  const impactKey = quizResults.layer7.impact?.toLowerCase().replace(/-/g, '-') || 'balanced impact';

  const profile: EdnaProfileFull = {
    userId,
    completedAt,
    layers: {
      layer1: {
        title: 'Core Type',
        coreType: layer1Data.name,
        strength: quizResults.layer1.strength || 'Moderate',
        description: layer1Data.description,
        traits: layer1Data.traits,
        decisionStyle: layer1Data.decisionStyle,
        strengthAreas: layer1Data.strengthAreas,
        blindSpots: layer1Data.blindSpots,
      },
      layer2: {
        title: 'Subtype',
        subtype: layer2Data.name,
        description: layer2Data.description,
        approach: layer2Data.approach,
        strengths: layer2Data.strengths,
        challenges: layer2Data.challenges,
      },
      layer3: {
        title: 'Integration Level',
        level: layer3Data.level,
        integrationPercent: quizResults.layer3.integrationPercent || 0,
        description: layer3Data.description,
        meaning: layer3Data.meaning,
        recommendation: layer3Data.recommendation,
      },
      layer4: {
        title: 'Learning & Working Style',
        modality: quizResults.layer4.modalityPreference || 'Visual',
        modalityDescription: LAYER_4_MODALITY[modalityKey] || 'This person has a unique learning modality.',
        approach: quizResults.layer4.approach || 'Sequential',
        approachDescription: LAYER_4_APPROACH[approachKey] || 'This person has a unique approach to learning.',
        conceptProcessing: quizResults.layer4.conceptProcessing || 'Concrete',
        conceptDescription: LAYER_4_CONCEPT_PROCESSING[conceptKey] || 'This person processes concepts uniquely.',
        environment: quizResults.layer4.workingEnvironment || 'Adaptive',
        environmentDescription: LAYER_4_ENVIRONMENT[envKey] || 'This person adapts to their environment.',
        pace: quizResults.layer4.pace || 'Flexible',
        paceDescription: LAYER_4_PACE[paceKey] || 'This person has a flexible pace.',
      },
      layer5: {
        title: 'Neurotype Status',
        status: layer5Data.status,
        description: layer5Data.description,
        strengths: layer5Data.strengths,
        considerations: layer5Data.considerations,
      },
      layer6: {
        title: 'Mindset & Communication',
        mindset: quizResults.layer6.mindset || 'Mixed',
        mindsetDescription: LAYER_6_MINDSET[mindsetKey] || 'This person has a unique mindset.',
        personality: quizResults.layer6.personality || 'Balanced',
        personalityDescription: LAYER_6_PERSONALITY[personalityKey] || 'This person has a balanced personality.',
        communication: quizResults.layer6.communication || 'Adaptive Communicator',
        communicationDescription: LAYER_6_COMMUNICATION[commKey] || 'This person adapts their communication style.',
      },
      layer7: {
        title: 'Core Values',
        faithOrientation: quizResults.layer7.faithOrientation || 'Balanced',
        faithDescription: LAYER_7_FAITH[faithKey] || 'This person has a balanced approach to faith.',
        controlOrientation: quizResults.layer7.controlOrientation || 'Situational',
        controlDescription: LAYER_7_CONTROL[controlKey] || 'This person adapts their control style.',
        fairness: quizResults.layer7.fairness || 'Balanced',
        fairnessDescription: LAYER_7_FAIRNESS[fairnessKey] || 'This person balances fairness considerations.',
        integrity: quizResults.layer7.integrity || 'Situational',
        integrityDescription: LAYER_7_INTEGRITY[integrityKey] || 'This person adapts their honesty style.',
        growth: quizResults.layer7.growth || 'Balanced',
        growthDescription: LAYER_7_GROWTH[growthKey] || 'This person balances growth and stability.',
        impact: quizResults.layer7.impact || 'Balanced Impact',
        impactDescription: LAYER_7_IMPACT[impactKey] || 'This person balances different types of impact.',
      },
    },
    characterSummary: '',
  };

  // Build character summary
  profile.characterSummary = buildCharacterSummary(profile);

  return profile;
}

/**
 * Build a character summary from the full profile
 */
function buildCharacterSummary(profile: EdnaProfileFull): string {
  const l1 = profile.layers.layer1;
  const l2 = profile.layers.layer2;
  const l3 = profile.layers.layer3;
  const l6 = profile.layers.layer6;
  const l7 = profile.layers.layer7;

  return `This person is a ${l1.coreType} (${l1.strength} strength) with a ${l2.subtype} subtype. ${l3.description} They have a ${l6.mindset} mindset and are ${l6.communication.toLowerCase()}. In terms of values, they are ${l7.faithOrientation.toLowerCase()} regarding faith, ${l7.controlOrientation.toLowerCase()} regarding control, and ${l7.growth.toLowerCase()} regarding personal development. Their decision style: ${l1.decisionStyle}`;
}
