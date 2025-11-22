import { Link } from 'react-router-dom';
import pasoLLLogo from '../../assets/PasoLL_Logo.png';
import './Footer.scss';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-brand">
            <h3 className="footer-title">SUB WARS V</h3>
            <p className="footer-tagline">THE ULTIMATE SHOWDOWN</p>
            <img 
              src={pasoLLLogo} 
              alt="PasoLL Logo" 
              className="footer-logo"
            />
          </div>
          
          <div className="footer-nav">
            <h4 className="footer-links-title">Quick Links</h4>
            <div className="footer-nav-links">
              <Link to="/" className="footer-link">
                Home
              </Link>
              {/* Hidden for now */}
              {/* <Link to="/quiz-info" className="footer-link">
                Quiz Info
              </Link>
              <Link to="/login" className="footer-link">
                Login
              </Link> */}
            </div>
          </div>
          
          <div className="footer-links">
            <h4 className="footer-links-title">Follow Us</h4>
            <div className="footer-social-links">
              <a 
                href="https://www.youtube.com/@PasoLL" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
                aria-label="YouTube"
              >
                YouTube
              </a>
              <a 
                href="https://www.instagram.com/pasolldota/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
                aria-label="Instagram"
              >
                Instagram
              </a>
              <a 
                href="https://discord.gg/qfnfBRU" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
                aria-label="Discord"
              >
                Discord
              </a>
              <a 
                href="https://chat.whatsapp.com/E8FfqeCY0r2LDBeAX3PTbb" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
                aria-label="WhatsApp Community"
              >
                WhatsApp Community
              </a>
              <a 
                href="https://x.com/PasollDota" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
                aria-label="X (Twitter)"
              >
                X
              </a>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p className="footer-copyright">
            Made after sacrificing creeps by casting{' '}
            <a 
              href="https://dota2.fandom.com/wiki/Lich/Old_Abilities#Sacrifice_(Pre_7.20)" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-credit-link"
            >
              sacrifice
            </a>{' '}
            by{' '}
            <a 
              href="https://parthjansari.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-credit-link"
            >
              Parth Jansari
            </a>
            . All rights reserved by{' '}
            <a 
              href="https://www.youtube.com/@PasoLL" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-credit-link"
            >
              PasoLL
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
