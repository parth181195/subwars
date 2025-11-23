import './FAQ.scss';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: 'How do I know if my registration is confirmed?',
    answer: 'You will be notified on Discord. Stay active on the official Discord server for all event updates.',
  },
  {
    question: 'What server will the matches be played on?',
    answer: 'All matches will be played on the Singapore server.',
  },
  {
    question: 'Do I need to stay for the entire event day?',
    answer: 'No. You only need to play one qualifier lobby. Join any available lobby during qualifiers. Winners advance to the main event; losers are knocked out.',
  },
  {
    question: 'How do players join the lobby?',
    answer: 'There will be 16 qualifier lobbies, hosted one after another. You must join a lobby quickly to secure your slot.',
  },
  {
    question: 'Can I switch teams or request to play with friends?',
    answer: 'No. Teams are assigned using Balanced Shuffle, which ensures random and fair matchmaking. Teaming, influencing captains, or any manipulation is strictly not allowed.',
  },
  {
    question: 'Is there any entry fee?',
    answer: 'Yes. This helps ensure genuine registrations and prevents multiple IDs or re-entry.',
  },
  {
    question: 'Can a player re-enter after being disqualified or losing?',
    answer: 'No. Re-entry is not allowed under any circumstances.',
  },
  {
    question: 'What if my internet disconnects during the game?',
    answer: 'You may reconnect if Dota 2 allows it. If you cannot reconnect, you will be disqualified from the event.',
  },
  {
    question: 'Is voice communication mandatory?',
    answer: 'Yes. Discord voice with a working microphone is mandatory for coordination and fair gameplay.',
  },
  {
    question: 'Will teams remain the same across matches?',
    answer: 'No. Teams will change every round as long as you keep qualifying.',
  },
  {
    question: 'What does "Open for All" mean?',
    answer: 'Players from all ranks — Herald to Immortal — are allowed to participate, as long as: Your rank is unlocked, and your medal and MMR are visible on your profile.',
  },
];

export default function FAQ() {
  return (
    <div className="faq-page">
      <div className="faq-container">
        <div className="faq-header">
          <h1 className="faq-title">Frequently Asked Questions</h1>
          <p className="faq-subtitle">
            Find answers to common questions about SUB WARS V and the Guess the Hero Contest
          </p>
        </div>

        <div className="faq-content">
          {faqData.map((faq, index) => (
            <div key={index} className="faq-item">
              <div className="faq-question">
                <span className="faq-number">{index + 1}</span>
                <h3>{faq.question}</h3>
              </div>
              <div className="faq-answer">
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="faq-footer">
          <p>
            Still have questions? Reach out to us on{' '}
            <a 
              href="https://discord.gg/qfnfBRU" 
              target="_blank" 
              rel="noopener noreferrer"
              className="faq-link"
            >
              Discord
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

