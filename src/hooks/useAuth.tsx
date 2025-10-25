import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, isLoading };
};

export const useAdminAuth = () => {
  // isAdmin is null while we don't yet know (avoids treating unknown as false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async () => {
      // If auth status is still loading, wait — do not decide yet.
      if (authLoading) {
        if (mounted) setIsLoading(true);
        return;
      }

      if (!user) {
        if (mounted) {
          setIsAdmin(false);
          setIsLoading(false);
        }
        return;
      }

      if (mounted) setIsLoading(true);

      try {
        // use maybeSingle so missing row doesn't throw
        const { data, error } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (error) {
          console.error("useAdminAuth fetch error:", error);
          if (mounted) {
            setIsAdmin(false);
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          setIsAdmin(!!data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("useAdminAuth unexpected error:", err);
        if (mounted) {
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    };

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  return { isAdmin, isLoading };
};
