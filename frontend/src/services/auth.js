export const handleLogout = (navigate) => {
    localStorage.clear()
    navigate('/')
}