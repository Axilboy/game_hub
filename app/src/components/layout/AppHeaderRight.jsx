import { useNavigate } from 'react-router-dom';
import { getAvatar, getDisplayName, getProfilePhoto } from '../../displayName';
import { getInventory } from '../../inventory';
import ThemeToggle from './ThemeToggle';

/**
 * Кнопка темы + имя и аватар (переход в профиль). Для главной и промо-лендингов.
 */
export default function AppHeaderRight({ user }) {
  const navigate = useNavigate();
  const inv = getInventory();
  const shownName = getDisplayName() || user?.first_name || 'Игрок';
  const profilePhoto = getProfilePhoto();
  const avatarEmoji = getAvatar();

  const sub = inv.hasPro ? 'Премиум' : 'Без Премиума';

  return (
    <div className="gh-header-actions">
      <ThemeToggle />
      <button
        type="button"
        className="gh-header-profile"
        onClick={() => navigate('/profile')}
        title="Профиль и достижения"
      >
        <span className="gh-header-profile__text">
          <span className="gh-header-profile__name">{shownName}</span>
          <span className="gh-header-profile__sub">{sub}</span>
        </span>
        <span className="gh-header-profile__avatar" aria-hidden>
          {avatarEmoji ? (
            <span className="gh-header-profile__emoji">{avatarEmoji}</span>
          ) : profilePhoto ? (
            <img src={profilePhoto} alt="" className="gh-header-profile__img" />
          ) : user?.photo_url ? (
            <img src={user.photo_url} alt="" className="gh-header-profile__img" />
          ) : (
            <span className="gh-header-profile__placeholder">{(shownName || '?')[0]}</span>
          )}
        </span>
      </button>
    </div>
  );
}
