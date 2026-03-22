import { useNavigate } from 'react-router-dom';
import { getAvatar, getDisplayName, getProfilePhoto } from '../../displayName';
import { getInventory } from '../../inventory';
import { useAuth } from '../../authContext';
import ThemeToggle from './ThemeToggle';

/**
 * Кнопка темы + имя и аватар. У гостя web_* — открывает форму входа; иначе — профиль.
 */
export default function AppHeaderRight() {
  const navigate = useNavigate();
  const { user, isGuestWeb, openAuthModal } = useAuth();
  const inv = getInventory();
  const shownName = getDisplayName() || user?.first_name || 'Игрок';
  const profilePhoto = getProfilePhoto();
  const avatarEmoji = getAvatar();

  const sub = inv.hasPro ? 'Премиум' : 'Без Премиума';

  const onProfileClick = () => {
    if (isGuestWeb) openAuthModal();
    else navigate('/profile');
  };

  return (
    <div className="gh-header-actions">
      <ThemeToggle />
      <button
        type="button"
        className="gh-header-profile"
        onClick={onProfileClick}
        title={isGuestWeb ? 'Вход и регистрация' : 'Профиль и достижения'}
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
