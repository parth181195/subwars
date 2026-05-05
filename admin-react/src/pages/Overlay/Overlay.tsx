import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeIcon } from '@primer/octicons-react';
import { getFirestoreDB, collection, doc, getDocs, setDoc, onSnapshot } from '../../services/firestore';
import './Overlay.scss';

interface RankPosition {
  pos: number | null;
}

interface RankOption {
  path: string;
  name: string;
  index: number;
}

const RANK_OPTIONS: RankOption[] = [
  { path: '/assets/medals/1.png', name: 'Herald', index: 1 },
  { path: '/assets/medals/2.png', name: 'Guardian', index: 2 },
  { path: '/assets/medals/3.png', name: 'Crusader', index: 3 },
  { path: '/assets/medals/4.png', name: 'Archon', index: 4 },
  { path: '/assets/medals/5.png', name: 'Legend', index: 5 },
  { path: '/assets/medals/6.png', name: 'Ancient', index: 6 },
  { path: '/assets/medals/7.png', name: 'Divine', index: 7 },
  { path: '/assets/medals/8.png', name: 'Immortal', index: 8 },
];

const INITIAL_PREFIX: RankPosition[] = [
  { pos: null },
  { pos: null },
  { pos: null },
  { pos: null },
  { pos: null },
];

const INITIAL_SUFFIX: RankPosition[] = [
  { pos: null },
  { pos: null },
  { pos: null },
  { pos: null },
  { pos: null },
];

interface RankData {
  prefix: RankPosition[];
  suffix: RankPosition[];
}

export default function Overlay() {
  const navigate = useNavigate();
  const [prefix, setPrefix] = useState<RankPosition[]>(INITIAL_PREFIX);
  const [suffix, setSuffix] = useState<RankPosition[]>(INITIAL_SUFFIX);
  const [openMenu, setOpenMenu] = useState<{ index: number; isSuffix: boolean } | null>(null);
  const [rankDocId, setRankDocId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadRanks = async () => {
      try {
        const db = getFirestoreDB();
        const ranksCollection = collection(db, 'ranks');
        const snapshot = await getDocs(ranksCollection);

        if (!snapshot.empty) {
          const firstDoc = snapshot.docs[0];
          const docId = firstDoc.id;
          setRankDocId(docId);
          const data = firstDoc.data() as RankData;

          if (data.prefix) {
            setPrefix(data.prefix);
          }
          if (data.suffix) {
            setSuffix(data.suffix);
          }

          // Subscribe to real-time updates
          const rankDocRef = doc(db, 'ranks', docId);
          unsubscribe = onSnapshot(rankDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
              const updatedData = docSnapshot.data() as RankData;
              if (updatedData.prefix) {
                setPrefix(updatedData.prefix);
              }
              if (updatedData.suffix) {
                setSuffix(updatedData.suffix);
              }
            }
          });
        } else {
          // Create initial document if it doesn't exist
          const newDocRef = doc(ranksCollection);
          const docId = newDocRef.id;
          setRankDocId(docId);
          await setDoc(newDocRef, {
            prefix: INITIAL_PREFIX,
            suffix: INITIAL_SUFFIX,
          });

          // Subscribe to real-time updates for the new document
          unsubscribe = onSnapshot(newDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
              const updatedData = docSnapshot.data() as RankData;
              if (updatedData.prefix) {
                setPrefix(updatedData.prefix);
              }
              if (updatedData.suffix) {
                setSuffix(updatedData.suffix);
              }
            }
          });
        }
      } catch (error) {
        console.error('Error loading ranks:', error);
      }
    };

    loadRanks();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenu]);

  const handleBoxClick = (index: number, isSuffix: boolean) => {
    setOpenMenu({ index, isSuffix });
  };

  const handleRankSelect = async (rankIndex: number) => {
    if (!rankDocId) return;

    try {
      const db = getFirestoreDB();
      const rankDocRef = doc(db, 'ranks', rankDocId);

      if (openMenu?.isSuffix) {
        const newSuffix = [...suffix];
        newSuffix[openMenu.index].pos = rankIndex + 1;
        await setDoc(rankDocRef, { prefix, suffix: newSuffix }, { merge: true });
        setSuffix(newSuffix);
      } else {
        const newPrefix = [...prefix];
        newPrefix[openMenu!.index].pos = rankIndex + 1;
        await setDoc(rankDocRef, { prefix: newPrefix, suffix }, { merge: true });
        setPrefix(newPrefix);
      }

      setOpenMenu(null);
    } catch (error) {
      console.error('Error updating rank:', error);
    }
  };

  const getMenuPosition = (index: number, isSuffix: boolean) => {
    // Calculate menu position based on box position
    const boxWidth = 83;
    const boxHeight = 50;
    const leftOffset = isSuffix ? 550 + index * boxWidth : index * boxWidth;
    return {
      top: `${87 + boxHeight + 5}px`,
      left: `calc(50% - 550px + ${leftOffset}px)`,
    };
  };

  return (
    <div className="overlay-container">
      <div className="bg">
        {/* Back to Home Button */}
        <button className="back-to-home-button" onClick={() => navigate('/dashboard')} aria-label="Back to Dashboard">
          <HomeIcon size={20} />
        </button>

        <div className="boxes-wrapper">
          <div className="prefix sections">
            {prefix.map((rank, index) => (
              <div
                key={index}
                className={`box ${rank.pos === null ? 'blank' : ''}`}
                onClick={() => handleBoxClick(index, false)}
              >
                {rank.pos !== null && (
                  <img src={`/assets/medals/${rank.pos}.png`} alt={RANK_OPTIONS[rank.pos - 1]?.name || 'Rank'} />
                )}
              </div>
            ))}
          </div>
          <div className="suffix sections">
            {suffix.map((rank, index) => (
              <div
                key={index}
                className={`box ${rank.pos === null ? 'blank' : ''}`}
                onClick={() => handleBoxClick(index, true)}
              >
                {rank.pos !== null && (
                  <img src={`/assets/medals/${rank.pos}.png`} alt={RANK_OPTIONS[rank.pos - 1]?.name || 'Rank'} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dropdown Menu */}
        {openMenu && (
          <div
            ref={menuRef}
            className="rank-menu"
            style={getMenuPosition(openMenu.index, openMenu.isSuffix)}
          >
            {RANK_OPTIONS.map((rank, index) => (
              <button
                key={rank.index}
                className="rank-menu-item"
                onClick={() => handleRankSelect(index)}
              >
                {rank.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
