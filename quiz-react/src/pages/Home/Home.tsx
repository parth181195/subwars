import { Link } from 'react-router-dom';
import { Button } from '@primer/react';
import { useRef, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import { environment } from '../../config/environment';
import ToastContainer, { useToast } from '../../components/Toast/ToastContainer';
import teamMember1 from '../../assets/images/1.png';
import teamMember2 from '../../assets/images/2.png';
import teamMember3 from '../../assets/images/3.png';
import teamMember4 from '../../assets/images/4.png';
import teamMember5 from '../../assets/images/5.png';
import teamMember6 from '../../assets/images/6.png';
import './Home.scss';

interface TeamMemberCardProps {
  image: string;
  name: string;
  alt: string;
  glowColor?: string;
}

const glowColors = [
  'rgba(102, 192, 244, 0.25)', // Blue for PasoLL
  'rgba(102, 192, 244, 0.25)', // Blue for Fake_PasoLL
  'rgba(147, 51, 234, 0.25)', // Purple for $iNG]-[aM
  'rgba(234, 179, 8, 0.25)', // Yellow for Illidan Stormage
  'rgba(239, 68, 68, 0.25)', // Red for Odawg
  'rgba(34, 197, 94, 0.25)', // Green for Slappy
];

function TeamMemberCard({ image, name, alt, glowColor }: TeamMemberCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !avatarRef.current) return;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (!cardRef.current || !avatarRef.current) return;
      
      const card = cardRef.current;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 12;
      const rotateY = (centerX - x) / 12;
      
      avatarRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (!avatarRef.current) return;
    
    requestAnimationFrame(() => {
      if (avatarRef.current) {
        avatarRef.current.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
      }
    });
  }, []);

  const currentGlowColor = glowColor || 'rgba(102, 192, 244, 0.4)';

  // Extract alias from name (format: "Name 'Alias' LastName")
  const nameParts = name.match(/^(.+?)\s+"([^"]+)"\s+(.+)$/);
  const firstName = nameParts ? nameParts[1] : '';
  const alias = nameParts ? nameParts[2] : '';
  const lastName = nameParts ? nameParts[3] : '';

  return (
    <div 
      className="team-member"
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className="team-member-avatar"
        ref={avatarRef}
        style={{ '--glow-color': currentGlowColor } as React.CSSProperties}
      >
        <img src={image} alt={alt} />
      </div>
      <div className="team-member-info">
        <h3 className="team-member-name">
          {nameParts ? (
            <>
              {firstName} <span className="team-member-alias" style={{ '--glow-color': currentGlowColor } as React.CSSProperties}>&quot;{alias}&quot;</span> {lastName}
            </>
          ) : (
            name
          )}
        </h3>
      </div>
    </div>
  );
}

export default function Home() {
  const { toasts, addToast, removeToast } = useToast();

  // Initialize WebSocket connection for notifications
  useEffect(() => {
    const socketUrl = environment.apiUrl.replace('/api', '');
    const newSocket = io(`${socketUrl}/quiz`, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to quiz server for notifications');
    });

    newSocket.on('question-live', (data: { question: { order_index?: number }; timeRemaining: number }) => {
      addToast({
        type: 'info',
        title: 'New Question is Live!',
        message: `Question #${(data.question?.order_index ?? 0) + 1} is now active. Join the quiz to participate!`,
        duration: 8000,
      });
    });

    newSocket.on('question-winner', (data: { winner: { user_name: string; response_time: number }; questionNumber: number }) => {
      addToast({
        type: 'success',
        title: `Question #${data.questionNumber} Winner!`,
        message: `🎉 ${data.winner.user_name} answered correctly in ${(data.winner.response_time / 1000).toFixed(2)}s!`,
        duration: 10000,
      });
    });

    newSocket.on('quiz-winners', (data: { winners: Array<{ user_name: string; total_score: number }>; quizName: string }) => {
      const winnersList = data.winners
        .map((w, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          return `${medal} ${i + 1}. ${w.user_name} - ${w.total_score} pts`;
        })
        .join('\n');
      addToast({
        type: 'success',
        title: `🏆 ${data.quizName} - Top 3 Winners!`,
        message: winnersList,
        duration: 15000,
      });
    });

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [addToast]);

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="home-page">
      {/* Main Hero Section */}
      <section className="hero-section">
        <video 
          className="hero-video"
          autoPlay
          poster="https://cdn.steamstatic.com/apps/dota2/images/dota_react/kez/kez_header_loop_poster.png"
          preload='auto'
          loop
          muted
          playsInline
        >
          <source src="https://cdn.steamstatic.com/apps/dota2/videos/dota_react/kez/kez_header_loop.webm" type="video/webm" />
        </video>
        
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="title-word">SUB</span>
            <span className="title-word">WARS</span>
            <span className="title-word">V</span>
          </h1>
          
          <h2 className="hero-subheading">THE ULTIMATE SHOWDOWN</h2>
          
          <div className="hero-dates">
            <span className="date-item">13</span>
            <span className="date-separator">•</span>
            <span className="date-item">14</span>
            <span className="date-separator">•</span>
            <span className="date-item">20</span>
            <span className="date-separator">•</span>
            <span className="date-item">21</span>
            <span className="date-separator">•</span>
            <span className="date-month">December</span>
          </div>
          
          <div className="hero-description">
            <span className="hosted-by">Hosted by PasoLL</span>
            <span className="description-text">, SUB WARS V brings together players and fans for an epic Dota 2 community tournament like never before. This is the biggest open-for-all Dota 2 event of the year — players from Herald to Immortal can participate and experience true competitive action.</span>
          </div>
          

          <div className="hero-actions">
            <a 
              href="https://forms.gle/bu5rEYGYBc97aszN7" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hero-button-link"
            >
              <Button variant="primary" className="hero-button">
                REGISTER FOR SUB WARS V
              </Button>
            </a>
            <div className="hero-secondary-buttons">
              <Link to="/format">
                <Button variant="default" className="hero-secondary-button">
                  Format
                </Button>
              </Link>
              <Link to="/faq">
                <Button variant="default" className="hero-secondary-button">
                  FAQs
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Features Container */}
        <div className="features-container">
          <h2 className="features-title">The Ultimate Showdown</h2>
          
          <p className="features-description">
          Watch top-tier, exciting gameplay, experience adrenaline-packed matchups, and cheer on your friends as the community comes together for an action-filled SUB WARS V packed with strategy, hype, and unforgettable moments.
          </p>

          {/* Feature Section 1 - Text Left, Image Right */}
          <div className="feature-section">
            <div className="feature-text">
              <h3 className="feature-section-title">Livestream</h3>
              <p className="feature-section-description">
              Join hundreds of viewers as India’s Dota 2 community comes together for a one-of-a-kind event featuring player comms, intense community clashes, and participation from all ranks — from Herald to Immortal.
              </p>
            </div>
            <div className="feature-image">
              <img src="https://cdn.steamstatic.com/apps/dota2/images/dota_react//winter2023/ward.png" alt="Livestream" />
            </div>
          </div>

          {/* Feature Section 2 - Image Left, Text Right */}
          <div className="feature-section feature-section-reverse">
            <div className="feature-text">
              <h3 className="feature-section-title">Guess The Hero & Giveaways</h3>
              <p className="feature-section-description">
              Dive into the Guess the Hero Contest during SUB WARS V and win big even without playing in the tournament! Open to the entire community, this contest lets you test your Dota 2 knowledge live, race up the leaderboard, and claim exciting prizes. Stand a chance to win gaming products, Steam Wallet codes, and tons of surprise giveaways.
              </p>
            </div>
            <div className="feature-image">
              <img src="https://cdn.steamstatic.com/apps/dota2/images/dota_react//springcleaning2025/performance/performance.png" alt="Audience Quiz" />
            </div>
          </div>

          {/* Stats Section */}
          <div className="stats-section">
            <h2 className="stats-title">SUB WARS By The Numbers</h2>
            <div className="stats-grid">
              <div className="stat-item stat-item-featured">
                <div className="stat-value">₹4,00,000+</div>
                <div className="stat-label">Cumulative Prize Pool</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">2,00,000+</div>
                <div className="stat-label">Watch Hours</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">50,000+</div>
                <div className="stat-label">Total Views</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">15,000+</div>
                <div className="stat-label">Unique Viewers</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">6,000+</div>
                <div className="stat-label">Community Members</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">350+</div>
                <div className="stat-label">Peak Viewers</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">100+</div>
                <div className="stat-label">Giveaways</div>
              </div>
            </div>
          </div>

          {/* Call to Action Section */}
          <div className="cta-section">
            <img 
              src="https://cdn.steamstatic.com/apps/dota2/images/dota_react/international2024/compendium/5hero_lockup.png" 
              alt="Hero lockup" 
              className="cta-bg-image"
            />
            <h2 className="cta-main-title">JOIN THE ULTIMATE SHOWDOWN</h2>
            <p className="cta-main-description">
            Join hundreds of players from Herald to Immortal in India’s most unique and biggest open-for-all Dota 2 event — SUB WARS V!
            </p>
            <a 
              href="https://forms.gle/bu5rEYGYBc97aszN7" 
              target="_blank" 
              rel="noopener noreferrer"
              className="cta-button-link"
            >
              <Button variant="primary" className="cta-button">
              REGISTER FOR SUB WARS V
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="team-section">
        <div className="team-container">
          <h2 className="team-title">Meet The Team</h2>
          <div className="team-grid">
            <TeamMemberCard 
              image={teamMember1} 
              name="Omkar &quot;PasoLL&quot; Urunkar" 
              alt="Omkar Urunkar"
              glowColor={glowColors[0]}
            />
            <TeamMemberCard 
              image={teamMember2} 
              name="Parth &quot;Fake_PasoLL&quot; Jansari" 
              alt="Parth Jansari"
              glowColor={glowColors[1]}
            />
            <TeamMemberCard 
              image={teamMember3} 
              name="Omkar &quot;$iNG]-[aM&quot; Khopkar" 
              alt="Omkar Khopkar"
              glowColor={glowColors[2]}
            />
            <TeamMemberCard 
              image={teamMember4} 
              name="Omkar &quot;Illidan Stormage&quot; Dhende" 
              alt="Omkar Dhende"
              glowColor={glowColors[3]}
            />
            <TeamMemberCard 
              image={teamMember5} 
              name="Purujit &quot;Odawg&quot; Chaturvedi" 
              alt="Purujit Chaturvedi"
              glowColor={glowColors[4]}
            />
            <TeamMemberCard 
              image={teamMember6} 
              name="Rohit &quot;Slappy&quot; Deshpande" 
              alt="Rohit Deshpande"
              glowColor={glowColors[5]}
            />
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
