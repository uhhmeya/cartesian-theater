export const UserAvatar = ({ username, className = '' }) => (
    <div className={`${className}`}>{username[0].toUpperCase()}</div>
)