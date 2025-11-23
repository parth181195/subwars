import './Format.scss';

interface Rule {
  number: number;
  title: string;
  content: string[];
}

const rulesList: Rule[] = [
  {
    number: 1,
    title: 'Game Mode',
    content: ['Captains Mode (Team captain selected mutually by team members)'],
  },
  {
    number: 2,
    title: 'Registration',
    content: [
      'Register as a solo player',
      'Slots will be allocated on a first-come, first-served basis',
    ],
  },
  {
    number: 3,
    title: 'Balanced Shuffle',
    content: [
      'New balanced teams every game',
      'No team requests, no playing with friends',
    ],
  },
  {
    number: 4,
    title: 'Discord Requirement',
    content: [
      'Mandatory with a working microphone',
      'You must stay active on Discord throughout the event',
      'If you are unreachable, you may lose your slot',
    ],
  },
  {
    number: 5,
    title: 'Main ID Only',
    content: [
      'Participants must use their primary account with rank unlocked',
      'Medal and MMR must be visible',
    ],
  },
  {
    number: 6,
    title: 'Be Considerate',
    content: [
      'Respect all players',
      'Players of all ranks (Herald to Immortal) participate together',
      'Help maintain a friendly community environment',
    ],
  },
  {
    number: 7,
    title: 'No Toxicity',
    content: [
      'No verbal abuse, flaming, insults, threats, or offensive behavior',
      'No harassment toward players, moderators, or admins',
    ],
  },
  {
    number: 8,
    title: 'No Griefing',
    content: [
      'No intentional feeding, ruining lanes, afk jungling, grief picks, or sabotaging teammates',
      'Verified griefing = immediate disqualification',
    ],
  },
  {
    number: 9,
    title: 'No Tipping / No All Chat',
    content: [
      'Tipping is not allowed',
      'All Chat is not allowed. Only necessary things like - GLHF, Pause, GG, Gwr, etc.',
      'Keep communication clean and team-focused',
    ],
  },
  {
    number: 10,
    title: 'No Vulgar IGNs',
    content: ['Use appropriate, non-offensive in-game names only'],
  },
  {
    number: 11,
    title: 'Strict Penalties',
    content: [
      'Immediate disqualification for harassment, unsportsmanlike behavior, or rule violations',
      'Repeated offenses may lead to permanent event bans',
    ],
  },
  {
    number: 12,
    title: 'No Smurfing',
    content: [
      'Only your highest-ranked main account is allowed',
      'Immediate ban for smurfing or using alternate accounts',
    ],
  },
  {
    number: 13,
    title: 'Pause Time',
    content: ['5 minutes of total pause time per player. After that game will be remade or resumed depending on the duration of the game.'],
  },
  {
    number: 14,
    title: 'No Re-Entry',
    content: ['No re-entry after losing or being disqualified'],
  },
  {
    number: 15,
    title: 'Disconnection Rule',
    content: [
      'If you disconnect, you must rejoin immediately',
      'If you cannot rejoin, you will be disqualified from the event',
    ],
  },
  {
    number: 16,
    title: 'Prize Money',
    content: ['Distributed via UPI only'],
  },
  {
    number: 17,
    title: 'Second Chance',
    content: [
      'There might be lucky draw for players who lose in the event',
      'You must be present on Discord to be eligible',
      'If you lose and aren\'t active on Discord, you won\'t be included in the lucky draw',
    ],
  },
  {
    number: 18,
    title: 'Final Authority',
    content: ['PASOLL\'S DECISION WILL BE FINAL'],
  },
];

export default function Format() {
  return (
    <div className="format-page">
      <div className="format-container">
        <div className="format-header">
          <h1 className="format-title">Format & Rules</h1>
          <p className="format-subtitle">
            Everything you need to know about SUB WARS V tournament format and rules
          </p>
        </div>


        {/* Full Rules List */}
        <section className="rules-section">
          <div className="rules-list">
            {rulesList.map((rule) => (
              <div key={rule.number} className="rule-item">
                <div className="rule-header">
                  <span className="rule-number">{rule.number}</span>
                  <h3 className="rule-title">{rule.title}</h3>
                </div>
                <ul className="rule-content">
                  {rule.content.map((item, index) => (
                    <li key={index} className="rule-content-item">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <div className="format-cta">
          <h3>Ready to Participate?</h3>
          <p>Register now to secure your spot in SUB WARS V!</p>
          <a 
            href="https://forms.gle/bu5rEYGYBc97aszN7" 
            target="_blank" 
            rel="noopener noreferrer"
            className="cta-button"
          >
            Register for SUB WARS V
          </a>
        </div>
      </div>
    </div>
  );
}

