export const SidebarItem = ({ children, active, onClick, className = '' }) => (
    <div className={`channel-item ${active ? 'active' : ''} ${className}`} onClick={onClick}>
        {children}
    </div>
)