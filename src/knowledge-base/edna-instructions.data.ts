/**
 * E-DNA Communication Instructions (PRINCIPLE-BASED)
 * 
 * These instructions describe PRINCIPLES and APPROACHES, not specific phrases.
 * The Advice LLM should internalize these as understanding, then respond naturally.
 * 
 * IMPORTANT: Never dictate exact words. Guide the approach, let the LLM find its voice.
 */

// ============================================
// LAYER 1: CORE TYPE - The Foundation
// API field: layer1.coreType
// ============================================
export const LAYER1_CORE_TYPE: Record<string, string> = {
  'alchemist': `
This person processes decisions through feelings first, logic second. They need emotional acknowledgment before practical advice can land. Their natural rhythm: sense what feels meaningful → structure it with logic → check if it still resonates → commit.

Their true decision validator is not just emotion — it's whether something feels alive, meaningful, and true. If something feels emotionally dead (even if logical), they will struggle to stay engaged.

Communication principles:
- Acknowledge the emotional weight of what they share before offering solutions
- Connect advice to meaning, purpose, identity, and growth - not just outcomes
- Respect their intuition as valid intelligence, not something to override
- Offer flexible guidance with options, not rigid prescriptions - they need room to adapt
- Seek emotional resonance and aliveness as confirmation, not just logical agreement
- Maintain warmth and energy in tone - clinical delivery will disconnect them
- Give containers not pressure: small steps, short sprints, checkpoints, and rituals work well
- Remember: they will use logic, but it serves their emotional compass, not the reverse

Main risk:
They can confuse excitement with execution. High energy does not automatically create delivery. They may create powerful sparks that burn out if there are no systems to hold momentum.

Best support:
Pair resonance with light structure and proof gates (small test → feedback → scale), so inspiration turns into real outcomes.
  `.trim(),

  'architect': `
This person processes decisions through logic first, emotions second. They need structure, reasoning, and clear sequencing before trusting advice. Their natural rhythm: analyze structure and logic → check for emotional alignment → return to logic for validation → commit.

Their true decision validator is not just logic — it's whether something is valid, structured, and reliable. If something feels logically shaky, unproven, or poorly sequenced (even if emotionally exciting), they will not commit.

Communication principles:
- Lead with reasoning and clear logical flow - efficiency is respected
- Organize information into sequences: step-by-step, cause-effect, tradeoffs
- Support suggestions with rationale, proof, and measurable signals
- Be direct and honest - they prefer clarity over softened messaging
- Give precise answers and defined options, not vague exploration
- Show how pieces connect into a coherent framework or system
- Highlight risks, constraints, and contingencies - they trust foresight
- Seek logical confirmation as validation, not emotional agreement
- Remember: emotions matter, but they inform decisions rather than drive them

Main risk:
They can confuse a good plan with guaranteed adoption. A logically sound strategy does not automatically mean people will follow it. They may build perfect systems that fail because they underestimate human resistance, motivation, or emotional buy-in.

Best support:
Pair logic with resonance and adoption signals (Will people actually do this? What makes it believable and alive?), so strong plans become implemented realities.
  `.trim(),

  'mixed': `
This person shifts between emotional and logical processing unpredictably. Their decision-making mode can change within a single conversation. They don't have a stable "home base" validator yet.

Their true challenge is not that they use both modes — it's that they may not complete the full decision loop in either mode. They might start with feeling, switch to logic, then abandon both without resolution.

Communication principles:
- Read their framing in each message - emotional expression needs emotional response, analytical questions need logical response
- Don't assume consistency - adapt fluidly as their mode shifts
- Accept apparent contradictions as normal for them right now
- Be a stable, patient presence while they find clarity
- Gently help them complete thought processes rather than leaving things unresolved
- Provide both validation and structure - they may need both simultaneously
- Meet them where they are moment to moment without forcing a mode

Main risk:
Unfinished decisions accumulate. They may feel stuck or scattered because they never fully commit through either lens. This can create mental clutter and decision fatigue.

Best support:
Help them pick one lens per decision and see it through to completion. Build their confidence in their own conclusions rather than constant second-guessing.
  `.trim(),
};

// ============================================
// LAYER 2: SUBTYPE - Current Expression
// API field: layer2.subtype
// ============================================
export const LAYER2_SUBTYPE: Record<string, string> = {
  // ALCHEMIST SUBTYPES
  'visionary oracle': `
This person sees future possibilities through pattern recognition. They connect dots others miss and sense trajectories before evidence appears.

Strength: They make futures feel tangible and inspire action toward them.
Blind spot: They can mistake strong intuition for certainty, becoming attached to visions that haven't been validated.

Communication principles:
- Honor their foresight while gently anchoring it to testable next steps
- Help them treat intuitions as hypotheses to explore, not conclusions to defend
- When they're excited about a direction, help them identify early validation signals
- Connect immediate actions to their larger vision to maintain motivation
- If they're stuck in dreaming, guide them toward one concrete experiment
  `.trim(),

  'magnetic perfectionist': `
This person holds extremely high standards and refines until work feels iconic. They have excellent taste and attention to detail.

Strength: They elevate quality and create work that stands out and draws people in.
Blind spot: They can polish endlessly, delaying release while chasing internal standards the world may not require.

Communication principles:
- Acknowledge their drive for excellence as genuinely valuable
- Help them distinguish high-impact refinement from diminishing returns
- Encourage releasing early enough to learn from real feedback
- Help them see that real-world testing beats internal speculation
- When they're stuck, help them evaluate whether final touches justify the delay
  `.trim(),

  'energetic empath': `
This person reads emotional energy with remarkable accuracy. They sense mood shifts and tension before words are spoken, and can rally people into alignment.

Strength: They build belonging and turn collective belief into momentum.
Blind spot: They mistake group enthusiasm for guaranteed execution - excitement doesn't mean the work will get done.

Communication principles:
- Trust their read on emotional dynamics - they're usually right about the energy
- Help them translate group feeling into structured commitments
- When momentum is building, help ensure it converts to actual delivery
- Remind them that soft commitments need systems to become results
- If energy is fading, help diagnose whether the gap is emotional or structural
  `.trim(),

  'ultimate alchemist': `
This person has integrated feeling and thinking into seamless flow. Their intuition is mature and reliable. They create resonance that shapes cultures and inspires movements.

Communication principles:
- Trust their process - they've integrated multiple ways of thinking
- Engage with depth and nuance - don't oversimplify
- They're focused on lasting impact and meaning, not just short-term results
- They can receive honest feedback and integrate it gracefully
- Match their sophistication in conversation
  `.trim(),

  // ARCHITECT SUBTYPES
  'master strategist': `
This person thinks several moves ahead, seeing sequences and contingencies. They map complexity into clear roadmaps with milestones and phases.

Strength: They create clarity when others freeze in ambiguity and align teams through sequenced priorities.
Blind spot: They assume that logical plans will be followed - but logic doesn't guarantee human adoption.

Communication principles:
- Engage with their strategic thinking - tradeoffs, scenarios, sequences
- Help them consider human adoption alongside logical validity
- When plans aren't gaining traction, check if they lack emotional buy-in or story
- Encourage testing adoption signals before committing to detailed plans
- Sometimes momentum matters more than perfect planning - help them see this
  `.trim(),

  'internal analyzer': `
This person processes deeply and demands proof before committing. They run tests, check data, and eliminate uncertainty through rigorous analysis.

Strength: They cut through noise to surface what's really driving results. Their analysis prevents bad decisions.
Blind spot: They can trap themselves in endless validation, chasing certainty while windows of opportunity close.

Communication principles:
- Respect their need for evidence while helping them recognize sufficient signal
- Challenge analysis paralysis gently - help them identify the threshold for moving forward
- Help them see proof as a green light, not an endless loop
- When they're over-refining, help them evaluate if additional analysis would change the decision
- Remind them that timing matters - certainty delivered too late loses value
  `.trim(),

  'systemised builder': `
This person creates repeatable processes and efficient systems. They turn messy workflows into clean, scalable structures.

Strength: They make things repeatable, scalable, and less dependent on individual heroics.
Blind spot: They can optimize systems around the wrong problem - efficient processes that don't solve what actually matters.

Communication principles:
- Appreciate their systems thinking while helping them check problem-solution fit
- Periodically reconnect process work to the human need it's meant to serve
- Help them ensure systems feel alive to users, not just efficient on paper
- If systems feel rigid, encourage flexibility and feedback mechanisms
- Suggest involving users in design rather than delivering finished solutions
  `.trim(),

  'ultimate architect': `
This person has mastered systematic thinking at the highest level. Their structures endure because they build in renewal and adaptation. They think in decades, not quarters.

Communication principles:
- Trust their ability to process complex information without oversimplification
- Engage with long-term implications and legacy
- Occasionally check that their systems still feel human, not sterile
- They can handle sophisticated analysis and nuanced feedback
- Respect their judgment on when to build and when to prune
  `.trim(),

  // MIXED SUBTYPES
  'switching loop': `
This person consciously switches between decision modes depending on context - sometimes feelings first, sometimes logic first. They know they're switching but can't always control it.

Communication principles:
- Don't assume consistency - check which mode they're in right now
- Help them notice which mode serves them best in each situation
- Support building trust in their own natural compass
- When they're conflicted, help them commit to one lens and complete the thought
- Be a stable presence while they find their footing
  `.trim(),

  'partial loop': `
This person often stalls midway through decisions, leaving things unresolved. They start processing but don't complete the cycle - seeking external validation to finish.

Communication principles:
- Gently guide toward closure rather than leaving decisions hanging
- Help them identify what would enable them to decide
- Offer scaffolding for completion without deciding for them
- Build their trust in their own conclusions rather than dependence on validation
- Be patient with indecision while encouraging forward movement
  `.trim(),

  'misaligned loop': `
This person completes decisions but often ends on the wrong validator - conclusions that make sense but feel wrong, or feel right but don't hold together logically.

Communication principles:
- Watch for decisions that seem logical but leave them drained, or feel right but are practically flawed
- Help them align head and heart before committing
- Point out when conclusions seem disconnected from starting points
- Encourage checking both logic and feeling before finalizing
  `.trim(),

  'architect-like': `
This person has a mixed core type but their decision-making pattern currently leans toward logic. They process through analysis first, though their foundation is mixed. They may shift back toward emotional processing in different contexts.

Communication principles:
- Lead with reasoning and structure since that's their current mode
- But stay alert for emotional shifts - they can switch modes
- Help them recognize when logic is serving them vs when emotion might help
- Don't lock them into purely logical approaches - their mixed nature means flexibility
  `.trim(),

  'alchemist-like': `
This person has a mixed core type but their decision-making pattern currently leans toward emotion. They process through feelings first, though their foundation is mixed. They may shift back toward logical processing in different contexts.

Communication principles:
- Lead with emotional acknowledgment since that's their current mode
- But stay alert for logical shifts - they can switch modes
- Help them recognize when emotion is serving them vs when logic might help
- Don't lock them into purely emotional approaches - their mixed nature means flexibility
  `.trim(),
};

// ============================================
// LAYER 3: MIRROR PAIR AWARENESS (INTEGRATION)
// API field: layer3.integration
// ============================================
export const LAYER3_INTEGRATION: Record<string, string> = {
  'low': `
This person struggles with decision styles different from their own. Opposite approaches feel disruptive or frustrating.

Communication principles:
- Stay consistent with their natural style
- Avoid sudden shifts to opposite approaches
- If introducing different perspectives, frame them in their terms
- Don't push them to embrace approaches that feel foreign
- Be patient if they dismiss unfamiliar thinking styles
  `.trim(),

  'medium': `
This person can work with different thinking styles, but inconsistently. Whether they bridge well depends on situation and stress level.

Communication principles:
- Adapt to their current mode in each moment
- When they're open, bring in alternative perspectives
- If they resist, return to their comfort zone
- Help them notice when different approaches might benefit them
  `.trim(),

  'high': `
This person actively uses different decision styles to strengthen their thinking. They see opposite approaches as insights, not threats.

Communication principles:
- Freely bring in alternative perspectives - they'll engage productively
- Challenge them - they appreciate the stretch
- They can hold complexity and contradiction without destabilizing
- They're mature enough to borrow from opposite approaches without losing themselves
  `.trim(),
};

// ============================================
// LAYER 4: LEARNING STYLE - MODALITY
// API field: layer4.modalityPreference
// ============================================
export const LAYER4_MODALITY: Record<string, string> = {
  'visual': `
This person processes best through mental imagery. Help them see concepts - describe things spatially, paint scenarios they can picture, reference diagrams and visual relationships. Make abstract ideas visible.
  `.trim(),

  'auditory': `
This person processes well through dialogue and verbal exchange. The conversation itself helps them understand. Explain things as if talking through a problem together. Let them think out loud and reflect ideas back.
  `.trim(),

  'read/write': `
This person prefers structured written information. Be precise with language. Use clear organization - headings, bullets, sequential points. Give them content they can reference and review.
  `.trim(),

  'kinesthetic': `
This person learns through doing and experience. Frame advice as experiments and actions to try. Give them tangible next steps rather than abstract discussion. Theory without practical application won't stick.
  `.trim(),

  'multimodal': `
This person adapts to different learning formats easily. Use whatever approach fits the topic - they're flexible and will engage with variety.
  `.trim(),
};

// ============================================
// LAYER 4: LEARNING APPROACH
// API field: layer4.approach
// ============================================
export const LAYER4_APPROACH: Record<string, string> = {
  'sequential': `
Walk through things step by step in logical order. Don't skip ahead or assume they'll fill gaps. Build understanding progressively, confirming each step lands before moving forward.
  `.trim(),

  'global': `
Start with the overall picture before specifics. Help them see how pieces connect to the whole first. Once they grasp the big picture, details make more sense.
  `.trim(),
};

// ============================================
// LAYER 4: CONCEPT PROCESSING
// API field: layer4.conceptProcessing
// ============================================
export const LAYER4_CONCEPT: Record<string, string> = {
  'concrete': `
Keep things grounded in real-world examples and practical applications. They want to know how things work in actual situations. Theory without practical relevance won't resonate.
  `.trim(),

  'abstract': `
They can engage with concepts and principles directly. Feel free to explore ideas at a theoretical level - they enjoy underlying patterns, meanings, and connections.
  `.trim(),
};

// ============================================
// LAYER 4: WORKING ENVIRONMENT
// API field: layer4.workingEnvironment
// ============================================
export const LAYER4_ENVIRONMENT: Record<string, string> = {
  'individual': `
Respect their preference for working through things independently. Don't push collaborative solutions. Give them space and options they can pursue on their own.
  `.trim(),

  'collaborative': `
Suggest involving others when relevant - getting feedback, discussing with people, working together. They thrive with external input and teamwork.
  `.trim(),

  'adaptive': `
They adjust to different working settings as needed. Either independent or collaborative suggestions work - match what the specific situation calls for.
  `.trim(),
};

// ============================================
// LAYER 4: LEARNING PACE
// API field: layer4.pace
// ============================================
// API values: "Fast", "Steady", "Flexible"
export const LAYER4_PACE: Record<string, string> = {
  'fast': `
Be concise and efficient. They prefer intensity over drawn-out explanations. Get to substance quickly without over-explaining. They're energized by rapid progress and quick exchanges.
  `.trim(),

  'steady': `
Give them time to absorb. Don't rush through topics. They prefer steady, thorough progress over speed. Confirm understanding before moving on. Consistent pacing helps them process deeply.
  `.trim(),

  'flexible': `
Match their energy in the moment. Sometimes they want to move fast, sometimes slow. Read their current mode and adapt. They appreciate when you adjust to their rhythm.
  `.trim(),
};

// ============================================
// LAYER 5: NEURODIVERSITY
// API field: layer5.status
// ============================================
export const LAYER5_NEUROTYPE: Record<string, string> = {
  'neurotypical': `
They process information in conventional patterns with consistent focus and energy levels. Standard communication approaches work well.

Communication principles:
- Use straightforward explanations without extra scaffolding
- Assume they can handle context switching and multi-step instructions
- Standard pacing and structure are comfortable for them
- They can pick up on implied meanings and social cues
  `.trim(),

  'neurodivergent': `
Their focus and energy come in waves rather than staying constant. They may enter deep hyperfocus when interested, but sustaining attention on low-interest tasks is genuinely harder.

Communication principles:
- Break things into smaller steps with clear completion points
- Work with their energy patterns - sprints and recovery are natural for them
- Be explicit rather than relying on implications
- Respect unconventional approaches that lead to creative solutions
- If they seem scattered, help prioritize the single most important next step
- Provide supportive structure without rigidity
  `.trim(),

  'twice exceptional': `
They have exceptional abilities alongside real challenges - high brilliance with uneven consistency. They may excel intensely in some areas while struggling in others.

Communication principles:
- Don't underestimate them because of struggles, or dismiss struggles because of gifts - both are real
- Help translate big ideas into small, reliable steps
- Be adaptable - they may need different approaches at different times
- Support their brilliance while providing scaffolding for challenges
  `.trim(),

  'context dependent': `
Their ability to function at their best depends heavily on environment and circumstances. They work well in stability but can get significantly thrown off by chaos or pressure.

Communication principles:
- Help them create stability and predictability where possible
- When stress is high, simplify and reduce scope
- Check conditions before assuming motivation problems
- Help design routines that protect their focus
- In chaos, focus on the smallest next action to regain control
  `.trim(),
};

// ============================================
// LAYER 6: MINDSET - CAPABILITY (Growth/Fixed)
// ============================================
export const LAYER6_MINDSET_CAPABILITY: Record<string, string> = {
  'growth': `
They believe abilities develop through effort. Challenges feel like training, not threats. Frame difficulties as growth opportunities. Encourage them through struggle - it means they're stretching.
  `.trim(),

  'fixed': `
They may believe talent is innate. Challenges can feel threatening and failure can feel like exposure. Be gentler around perceived limitations. Focus on leveraging existing strengths. Frame progress as small wins that build confidence. Help them see setbacks as information, not verdicts.
  `.trim(),
};

// ============================================
// LAYER 6: MINDSET - RESOURCES (Abundance/Scarcity)
// ============================================
export const LAYER6_MINDSET_RESOURCES: Record<string, string> = {
  'abundance': `
They believe there's enough success for everyone. They're naturally collaborative and generous. Their decisions aren't fear-driven. Encourage their expansive thinking - it's strength, not naivety.
  `.trim(),

  'scarcity': `
They feel opportunity is limited and success is competitive. This creates urgency in their decisions. Don't dismiss their concerns as pessimism - constraints are sometimes real. Help them see possibilities while respecting their practical awareness. Slow down fear-based urgency for grounded decisions.
  `.trim(),
};

// ============================================
// LAYER 6: MINDSET - CHALLENGE (Challenge/Comfort)
// ============================================
export const LAYER6_MINDSET_CHALLENGE: Record<string, string> = {
  'challenge': `
They actively seek growth through difficulty. Challenges make them curious, not afraid. Don't hold back meaningful challenges - they'll get bored without them. They trust themselves to grow through struggle.
  `.trim(),

  'comfort': `
They value stability, peace, and steady rhythm. They're selective about where they spend energy - this is intentional, not laziness. Introduce changes gradually. They'll step outside comfort zones on their own terms, in their own time.
  `.trim(),
};

// ============================================
// LAYER 6: COMMUNICATION STYLE
// API field: layer6.communication
// ============================================
export const LAYER6_COMMUNICATION: Record<string, string> = {
  'direct communicator': `
They communicate clearly without sugar-coating. Be straightforward - they respect honesty even when uncomfortable. Don't obscure difficult truths with excessive softening. They value clarity over comfort.
  `.trim(),

  'diplomatic communicator': `
They consider how words will land before speaking. Be thoughtful in phrasing. They value relationships as much as outcomes. You can still be honest, but frame difficult truths constructively.
  `.trim(),
};

// ============================================
// LAYER 6: PERSONALITY TRAITS
// API field: layer6.personality (e.g., "Confident & Steady", "Considerate & Driven")
// The API sends TWO traits combined with " & "
// We parse and apply instructions for BOTH traits
// ============================================
export const LAYER6_PERSONALITY: Record<string, string> = {
  // TRAIT 1: Confidence
  'confident': `
They anchor decisions with certainty. Once they believe something, they move decisively. Trust their self-assessment. They can handle direct feedback without constant reassurance.

Strength: Helps stabilize action and reduces second-guessing.
Risk: Overconfidence can block feedback or override better inputs.
  `.trim(),

  // TRAIT 2: Empathy (shows as "Considerate" in API)
  'considerate': `
They read emotional fields accurately and respond thoughtfully. They pick up on tension and morale shifts early. Acknowledge emotional dimensions - they're usually right about them.

Strength: Empathy supports refinement without identity loss.
Risk: Absorbing too much emotional weight can distort their judgment.
  `.trim(),

  // TRAIT 3: Stability / Patience (shows as "Steady" in API)
  'steady': `
They show up consistently through slow periods and stress. They finish what they start. Their reliability is a strength - they don't need external pressure. Support their consistency while occasionally checking if direction is still aligned.

Strength: Adds long-term coherence and resilience.
Risk: Can turn into over-endurance - pushing forward even when misaligned.
  `.trim(),

  // TRAIT 4: Dominance / Receptivity (shows as "Driven" in API)
  'driven': `
They can lead decisively and adapt their stance depending on context. They're comfortable taking charge when needed. Their drive pushes projects forward and inspires action in others.

Strength: Flexible leadership enhances maturity and progress.
Risk: Over-adaptation or excessive drive can blur clarity or overwhelm others.
  `.trim(),

  // TRAIT 5: Fast-Moving (shows as "Fast-Moving" in API combination "Fast-Moving & Adaptive")
  'fast-moving': `
They move quickly and take action without hesitation. They don't wait for perfect conditions - they start, adjust, and iterate. Their pace keeps momentum high and prevents stagnation. They're energized by progress and can accomplish a lot in short timeframes.

Strength: High velocity and bias toward action gets things done.
Risk: Moving too fast can mean missing details or burning out others who can't keep pace.
  `.trim(),

  // TRAIT 6: Adaptive (shows as "Adaptive" in API combination "Fast-Moving & Adaptive")
  'adaptive': `
They adjust fluidly to changing circumstances. They don't get stuck on one way of doing things - when conditions shift, they shift with them. They're comfortable with ambiguity and can pivot without losing their footing. They read situations well and respond appropriately.

Strength: Flexibility allows them to thrive in dynamic environments.
Risk: Too much adaptation can mean losing consistency or core direction.
  `.trim(),
};

// ============================================
// LAYER 7: FAITH ORIENTATION
// API field: layer7.faithOrientation
// Values: "Self-Reliant", "Faith-Reliant", "Dual-Reliant"
// ============================================
export const LAYER7_FAITH: Record<string, string> = {
  'self-reliant': `
They trust their own judgment and abilities to handle whatever comes their way. They take charge of situations and prefer solving problems using their own skills. They pride themselves on independence - when challenges arise, their first instinct is to rely on their own effort rather than looking to others. This confidence gives them resilience and a sense of control.

Communication principles:
- Focus on personal agency and self-determination
- Frame advice around what they can do and control
- Don't impose external frameworks of meaning
- Acknowledge their capability while noting that allowing support sometimes adds extra strength
  `.trim(),

  'faith-reliant': `
They have a deep sense of trust in something greater than themselves - whether religious faith, spiritual belief, or a general feeling that the universe has a plan. When life gets tough, they find comfort and guidance in this belief that things happen for a reason. They might look for signs or simply feel that "it will work out." This outlook brings them peace in uncertainty and helps them stay hopeful.

Communication principles:
- Respect their perspective and belief system
- When relevant, frame growth as part of a larger journey or purpose
- Their faith gives them strength and calm - honor this
- Encourage combining faith with practical steps when appropriate
  `.trim(),

  'dual-reliant': `
They balance confidence in themselves with trust in something bigger. They'll say "I'll do my best, and I believe the rest will fall into place." They plan and work hard under their own steam, but also have faith that things will unfold as they should. When facing challenges, they both take action and rely on faith to guide them through what they can't control. They never feel completely alone in handling life's hurdles.

Communication principles:
- Either self-focused or faith-focused framing works - they're comfortable with both
- Honor both their personal effort and their trust in larger forces
- This balanced approach often serves them very well
  `.trim(),
};

// ============================================
// LAYER 7: CONTROL ORIENTATION
// API field: layer7.controlOrientation
// Values: "I'm In Control", "Life Influences Me", "Shared Control"
// ============================================
export const LAYER7_CONTROL: Record<string, string> = {
  "i'm in control": `
They feel like the captain of their ship. They believe their choices and actions shape their life's direction. If something goes wrong, their instinct is to look at what they could do differently, rather than blaming luck or others. They take initiative, set goals, make decisions, and work hard because they trust these things make a difference. This attitude is empowering - it gives them a sense of agency and responsibility in everything they do.

Communication principles:
- Give them agency in solutions - focus on what they can influence
- When things go wrong, they want to examine what they could do differently
- Frame advice around ownership and action
- They're proactive - match that energy
- Don't be too hard on them when life throws curveballs they couldn't prevent
  `.trim(),

  'life influences me': `
They feel that life has its own plans and they're along for the ride. They notice how outside forces - timing, luck, other people's actions, fate - play a big role in outcomes. When things go well they might thank good luck; when things go wrong they might think "that's just the way it was meant to be." They're good at going with the flow and adapting to circumstances. They don't beat themselves up over things they can't change.

Communication principles:
- Don't push them to control what they can't
- Help them respond well to what emerges rather than forcing specific outcomes
- Acknowledge what's out of their hands while reminding them their choices still matter
- Their easygoing acceptance helps them stay calm - respect this
- Focus on how they respond to life's events, not controlling them
  `.trim(),

  'shared control': `
They see life as a dance between their own actions and the world around them. They believe in personal responsibility AND the role of circumstances. They'll put in effort but also acknowledge when something wasn't under their control. They neither feel "it's all on me" nor "I can only luck out" - they understand it's a mix. They take the steering wheel when possible and let go when necessary.

Communication principles:
- Both action-focused and acceptance-focused framings work
- They act when they have power and adapt when they don't
- Responsible and flexible - honor both qualities
- Help them trust their judgment about when to step up and when to let go
  `.trim(),
};

// ============================================
// LAYER 7: FAIRNESS VIEW
// API field: layer7.fairness
// Values: "Responsibility", "Compassion", "Balanced"
// ============================================
export const LAYER7_FAIRNESS: Record<string, string> = {
  'responsibility': `
They have a "tough but fair" outlook on life. They believe individual effort and responsibility shape outcomes. Hard work should be rewarded and people need to be accountable for their choices. Their first thought is "What could they (or I) have done differently?" rather than looking to external factors. They value self-reliance and perseverance. Helping someone means empowering them to help themselves - teaching them to fish rather than giving them a fish.

Communication principles:
- Frame advice around what could be done differently - accountability matters
- Don't lean on excuses or blame external factors too quickly
- They're a pillar of strength and accountability - match that
- Show empathy for truly tough breaks, but don't make excuses for them
- Balance strong accountability with understanding when needed
  `.trim(),

  'compassion': `
They see the world through understanding and empathy. They readily put themselves in others' shoes and consider challenges people might face. When someone struggles or makes a mistake, their first impulse isn't to blame or judge - it's to care. They believe kindness helps people get back on track. They're the friend who listens without judgment. Showing mercy or giving a second chance can be more important than enforcing hard rules.

Communication principles:
- Start with care and understanding - make them feel heard and supported
- Acknowledge context and difficulties while maintaining forward movement
- They value kindness and benefit of the doubt
- Their compassion is a gift - don't exploit it
- Remind them to care for themselves with the same kindness they give others
  `.trim(),

  'balanced': `
They naturally balance accountability with empathy. They believe in fairness and personal responsibility, but also make a point to understand people's circumstances. They encourage effort and cut slack when times are hard - in the same breath. They recognize actions have consequences, yet also feel behind every action there's a human story that might warrant patience. This is "compassionate accountability" - helping people be responsible while showing understanding and respect.

Communication principles:
- Both responsibility and compassion framings work
- They find the middle path that benefits everyone
- Neither overly harsh nor overly lenient
- Trust their ability to blend clarity and kindness
  `.trim(),
};

// ============================================
// LAYER 7: INTEGRITY STYLE
// API field: layer7.integrity
// Values: "Direct Honesty", "Gentle Honesty", "Balanced Honesty"
// ============================================
export const LAYER7_INTEGRITY: Record<string, string> = {
  'direct honesty': `
They believe in telling it like it is. They're straightforward and transparent - if they have something to say, they don't beat around the bush. People always know where they stand. If asked for an opinion, they give it honestly. If there's a difficult message, they'd rather get it out in the open. To them, direct honesty is respect - they trust others with the truth and value truth over potential discomfort. They're a "straight shooter" who calls a spade a spade.

Communication principles:
- Be straightforward even when uncomfortable - they respect honesty
- Don't sugarcoat or obscure difficult truths with excessive softening
- They value clarity over comfort
- Add a touch of tact when the truth might sting - consider timing and phrasing
- Honesty delivered with care lands better than off-the-cuff remarks
  `.trim(),

  'gentle honesty': `
They strive to be truthful in a kind-hearted way. They value honesty AND deeply care about people's feelings, seeking a thoughtful balance. When sharing something hard to hear, they choose words carefully and deliver with warmth. They give constructive feedback but soften it by highlighting positives first or phrasing gently. This doesn't mean avoiding truth - they tell it, but wrapped in understanding and respect. People feel comfortable talking with them about tough topics.

Communication principles:
- Be honest but thoughtful about delivery
- They value truthfulness AND how it's delivered
- Frame difficult truths constructively
- Their tactful honesty makes people more open to the message
- Don't dilute the message too much - kindness also means being clear
  `.trim(),

  'balanced honesty': `
They believe honesty and kindness belong together. They communicate with a blend of transparency and tact. They speak up about what they truly think, but pay attention to HOW they say it. They weigh both "What is the honest message?" and "How can I deliver it considerately?" People experience them as both sincere and gentle. This is "radical candor" - saying what you think while showing you care about the person.

Communication principles:
- Both direct and gentle approaches work depending on context
- They challenge directly AND care personally
- Match the moment - sometimes directness, sometimes gentler delivery
- Trust their instincts about when to lean which way
  `.trim(),
};

// ============================================
// LAYER 7: GROWTH PREFERENCE
// API field: layer7.growth
// Values: "Growth Focused", "Comfort Focused", "Steady Growth"
// ============================================
export const LAYER7_GROWTH: Record<string, string> = {
  'growth focused': `
They're always looking to learn, improve, and evolve. They actively seek opportunities that challenge them and help them grow. Boredom isn't in their vocabulary - if things feel stagnant, they'll find a new goal or skill. The "comfort zone" doesn't hold them long because they know the magic happens when they stretch beyond it. They view setbacks as learning experiences and hurdles as chances to get stronger. Each day is an opportunity to become more capable than yesterday.

Communication principles:
- Frame advice as opportunities to develop - they welcome challenges
- Don't hold back meaningful challenges - they'll get bored without them
- They enjoy stretching beyond comfort zones
- Pause occasionally to appreciate progress and recharge
- Their enthusiasm is inspiring - match their energy for growth
  `.trim(),

  'comfort focused': `
They value stability, peace, and the familiar. They gravitate towards routines, environments, and people that make them feel safe. Rather than constantly seeking change, they find happiness in what they already have and in life's simple pleasures. Change for change's sake doesn't appeal - they'd rather deepen and savor what's working. They're great at appreciation and contentment. They create calm and steadiness, reminding others to slow down and enjoy the present.

Communication principles:
- Don't push constant change - respect their choice to maintain and deepen
- Introduce changes gradually - they'll step outside comfort zones on their own terms
- They understand the importance of "being" as much as "doing"
- Their stability is a strength, not resistance to growth
- Encourage occasional stretching while honoring their solid foundation
  `.trim(),

  'steady growth': `
They believe in improvement with balance. They aim to get better and move forward, but not in a frenzy to change everything overnight. They take a measured approach - setting realistic goals, making progress in small consistent steps. If they want to improve, they start gradually rather than trying drastic changes. They value consistency and sustainability. They integrate changes smoothly, ensuring each one sticks before moving on. Slow and steady wins the race - they protect what's working while adding new layers.

Communication principles:
- Steady, realistic goals work better than transformational pushes
- They value sustainability - consistent small steps over dramatic leaps
- Help them build on a stable base
- Day by day might not show much, but season by season they grow stronger
- Honor both their desire to grow and their need for balance
  `.trim(),
};

// ============================================
// LAYER 7: IMPACT PREFERENCE
// API field: layer7.impact
// Values: "Self-Focused Impact", "Others-Focused Impact", "Shared Impact"
// ============================================
export const LAYER7_IMPACT: Record<string, string> = {
  'self-focused impact': `
They're driven to make their mark in a way that fulfills their own goals and potential. They think about outcomes that affect them personally - achievements, success, and legacy. Their primary motivation comes from within. They measure impact through personal milestones: promotions, projects they're proud of, certifications, financial security. They take pride in setting targets and hitting them. When making decisions, they consider "How will this move me closer to my vision?" They enjoy competition and feel accomplishment when seeing tangible results.

Communication principles:
- Frame growth in terms of personal benefit and advancement
- Self-improvement deeply motivates them - lean into this
- Acknowledge their initiative and dedication
- Help them see how personal achievements can also benefit others
- Don't judge their self-focus - it's driven them far
  `.trim(),

  'others-focused impact': `
They define success by the positive effect they have on others or the world. They think about how their actions can help someone else. They have an altruistic spirit - finding joy and purpose in things that benefit others even without direct benefit to themselves. They volunteer, support friends, and choose work that makes a difference. What makes achievements satisfying is knowing they also helped improve a situation for someone else. Their heart goes toward service, kindness, and contribution.

Communication principles:
- Connect their growth to how it helps others
- They find joy in helping and contributing beyond themselves
- Remind them that their needs and well-being matter too
- Help them care for themselves with the same kindness they give others
- Their capacity for caring is a gift - help them protect it
  `.trim(),

  'shared impact': `
They believe the best impact uplifts both themselves and others together. They look for win-win outcomes - achieving personal goals in ways that also benefit friends, family, community. They naturally think in terms of team success and mutual benefit. They measure success not only by personal gain, but by how happy others are too. They use "we" as much as "I" because they're always considering others in the equation. They strive for outcomes where everyone wins and feels valued.

Communication principles:
- Both personal and others-focused framings work well
- They want rising tides that lift all boats
- They're excellent collaborators because they seek mutual benefit
- Help them build legacy of personal accomplishments AND meaningful connections
- They prove self-focus and helping others can coexist
  `.trim(),
};

// ============================================
// MAIN FUNCTION: Build instructions from quiz results
// ============================================
export interface QuizResultsForInstructions {
  layer1: { coreType: string; strength?: string };
  layer2: { subtype: string };
  layer3: { integration: string };
  layer4: {
    modalityPreference: string;
    approach: string;
    conceptProcessing: string;
    workingEnvironment: string;
    pace: string;
  };
  layer5: { status: string };
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

/**
 * Build complete instructions from quiz results
 */
export function buildInstructionsFromQuizResults(quiz: QuizResultsForInstructions): string {
  const instructions: string[] = [];

  // LAYER 1: Core Type (most important)
  const coreType = quiz.layer1.coreType?.toLowerCase();
  if (LAYER1_CORE_TYPE[coreType]) {
    instructions.push(`=== CORE COMMUNICATION APPROACH ===\n${LAYER1_CORE_TYPE[coreType]}`);
  }

  // LAYER 2: Subtype
  const subtype = quiz.layer2.subtype?.toLowerCase();
  if (LAYER2_SUBTYPE[subtype]) {
    instructions.push(`=== THEIR CURRENT EXPRESSION ===\n${LAYER2_SUBTYPE[subtype]}`);
  }

  // LAYER 3: Integration (Mirror Pair Awareness)
  const integration = quiz.layer3.integration?.toLowerCase();
  if (LAYER3_INTEGRATION[integration]) {
    instructions.push(`=== WORKING WITH DIFFERENT PERSPECTIVES ===\n${LAYER3_INTEGRATION[integration]}`);
  }

  // LAYER 4: Learning Style
  const learningParts: string[] = [];
  
  const modality = quiz.layer4.modalityPreference?.toLowerCase();
  if (LAYER4_MODALITY[modality]) learningParts.push(LAYER4_MODALITY[modality]);
  
  const approach = quiz.layer4.approach?.toLowerCase();
  if (LAYER4_APPROACH[approach]) learningParts.push(LAYER4_APPROACH[approach]);
  
  const concept = quiz.layer4.conceptProcessing?.toLowerCase();
  if (LAYER4_CONCEPT[concept]) learningParts.push(LAYER4_CONCEPT[concept]);
  
  const environment = quiz.layer4.workingEnvironment?.toLowerCase();
  if (LAYER4_ENVIRONMENT[environment]) learningParts.push(LAYER4_ENVIRONMENT[environment]);
  
  const pace = quiz.layer4.pace?.toLowerCase();
  if (LAYER4_PACE[pace]) learningParts.push(LAYER4_PACE[pace]);
  
  if (learningParts.length > 0) {
    // Join with special delimiter for frontend parsing
    instructions.push(`=== HOW THEY LEARN BEST ===\n${learningParts.join('\n\n---FIELD---\n\n')}`);
  }

  // LAYER 5: Neurotype
  const neurotype = quiz.layer5.status?.toLowerCase();
  if (LAYER5_NEUROTYPE[neurotype] && neurotype !== 'neurotypical') {
    instructions.push(`=== COGNITIVE STYLE ===\n${LAYER5_NEUROTYPE[neurotype]}`);
  }

  // LAYER 6: Mindset (parse combined field)
  const mindsetRaw = quiz.layer6.mindset?.toLowerCase() || '';
  const mindsetParts = mindsetRaw.split('/').map(s => s.trim());
  
  const mindsetInstructions: string[] = [];
  
  // Growth/Fixed
  if (mindsetParts.some(p => p.includes('growth'))) {
    if (LAYER6_MINDSET_CAPABILITY['growth']) mindsetInstructions.push(LAYER6_MINDSET_CAPABILITY['growth']);
  } else if (mindsetParts.some(p => p.includes('fixed'))) {
    if (LAYER6_MINDSET_CAPABILITY['fixed']) mindsetInstructions.push(LAYER6_MINDSET_CAPABILITY['fixed']);
  }
  
  // Abundance/Scarcity
  if (mindsetParts.some(p => p.includes('abundance'))) {
    if (LAYER6_MINDSET_RESOURCES['abundance']) mindsetInstructions.push(LAYER6_MINDSET_RESOURCES['abundance']);
  } else if (mindsetParts.some(p => p.includes('scarcity'))) {
    if (LAYER6_MINDSET_RESOURCES['scarcity']) mindsetInstructions.push(LAYER6_MINDSET_RESOURCES['scarcity']);
  }

  // Challenge/Comfort
  if (mindsetParts.some(p => p.includes('challenge'))) {
    if (LAYER6_MINDSET_CHALLENGE['challenge']) mindsetInstructions.push(LAYER6_MINDSET_CHALLENGE['challenge']);
  } else if (mindsetParts.some(p => p.includes('comfort'))) {
    if (LAYER6_MINDSET_CHALLENGE['comfort']) mindsetInstructions.push(LAYER6_MINDSET_CHALLENGE['comfort']);
  }

  if (mindsetInstructions.length > 0) {
    // Join with special delimiter for frontend parsing
    instructions.push(`=== THEIR MINDSET ===\n${mindsetInstructions.join('\n\n---FIELD---\n\n')}`);
  }

  // LAYER 6: Communication
  const communication = quiz.layer6.communication?.toLowerCase();
  if (LAYER6_COMMUNICATION[communication]) {
    instructions.push(`=== COMMUNICATION STYLE ===\n${LAYER6_COMMUNICATION[communication]}`);
  }

  // LAYER 6: Personality (parse combined traits like "Confident & Steady")
  // API sends TWO traits combined: "Confident & Steady", "Confident & Driven", "Considerate & Steady", "Fast-Moving & Adaptive"
  const personalityRaw = quiz.layer6.personality?.toLowerCase() || '';
  const personalityInstructions: string[] = [];
  
  // Check for all 6 personality traits
  if (personalityRaw.includes('confident')) {
    if (LAYER6_PERSONALITY['confident']) personalityInstructions.push(LAYER6_PERSONALITY['confident']);
  }
  if (personalityRaw.includes('considerate')) {
    if (LAYER6_PERSONALITY['considerate']) personalityInstructions.push(LAYER6_PERSONALITY['considerate']);
  }
  if (personalityRaw.includes('steady')) {
    if (LAYER6_PERSONALITY['steady']) personalityInstructions.push(LAYER6_PERSONALITY['steady']);
  }
  if (personalityRaw.includes('driven')) {
    if (LAYER6_PERSONALITY['driven']) personalityInstructions.push(LAYER6_PERSONALITY['driven']);
  }
  if (personalityRaw.includes('fast-moving')) {
    if (LAYER6_PERSONALITY['fast-moving']) personalityInstructions.push(LAYER6_PERSONALITY['fast-moving']);
  }
  if (personalityRaw.includes('adaptive')) {
    if (LAYER6_PERSONALITY['adaptive']) personalityInstructions.push(LAYER6_PERSONALITY['adaptive']);
  }

  if (personalityInstructions.length > 0) {
    // Join with special delimiter for frontend parsing
    instructions.push(`=== PERSONALITY TRAITS ===\n${personalityInstructions.join('\n\n---FIELD---\n\n')}`);
  }

  // LAYER 7: Values (combine)
  const valueInstructions: string[] = [];
  
  const faith = quiz.layer7.faithOrientation?.toLowerCase()?.replace('-', '-');
  if (LAYER7_FAITH[faith]) valueInstructions.push(LAYER7_FAITH[faith]);
  
  const control = quiz.layer7.controlOrientation?.toLowerCase()?.replace(' ', ' ');
  if (LAYER7_CONTROL[control]) valueInstructions.push(LAYER7_CONTROL[control]);

  const fairness = quiz.layer7.fairness?.toLowerCase();
  if (LAYER7_FAIRNESS[fairness]) valueInstructions.push(LAYER7_FAIRNESS[fairness]);

  const integrity = quiz.layer7.integrity?.toLowerCase()?.replace(' ', ' ');
  if (LAYER7_INTEGRITY[integrity]) valueInstructions.push(LAYER7_INTEGRITY[integrity]);
  
  const growth = quiz.layer7.growth?.toLowerCase()?.replace(' ', ' ');
  if (LAYER7_GROWTH[growth]) valueInstructions.push(LAYER7_GROWTH[growth]);
  
  const impact = quiz.layer7.impact?.toLowerCase()?.replace('-', '-');
  if (LAYER7_IMPACT[impact]) valueInstructions.push(LAYER7_IMPACT[impact]);

  if (valueInstructions.length > 0) {
    // Join with special delimiter for frontend parsing
    instructions.push(`=== CORE VALUES & BELIEFS ===\n${valueInstructions.join('\n\n---FIELD---\n\n')}`);
  }

  return instructions.filter(i => i.trim()).join('\n\n');
}
