import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Create a context to share user information across the app
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    // Add signOut function
    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error.message);
            throw error;
        }
        setUser(null);
    };

    // Fetch and set user details on initial load and on auth state change
    useEffect(() => {
        const fetchUser = async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const authUser = sessionData?.session?.user;

            if (authUser) {
                // Fetch user details from the 'users' table in Supabase
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', authUser.id)
                    .single();

                // If no error and user data exists, update the user state
                if (!error && userData) {
                    setUser({
                        ...authUser,
                        ...userData,
                        fullName: `${userData.first_name} ${userData.last_name}`
                    });
                }
            }
        };

        fetchUser();

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                fetchUser(); // Refresh user data if session changes
            } else {
                setUser(null); // Clear user data on logout
            }
        });

        return () => authListener?.subscription.unsubscribe();  // Clean up listener
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser, signOut }}>
            {children}  {/* Provide user data to all components inside AuthProvider */}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context easily in components
export const useAuth = () => useContext(AuthContext);
