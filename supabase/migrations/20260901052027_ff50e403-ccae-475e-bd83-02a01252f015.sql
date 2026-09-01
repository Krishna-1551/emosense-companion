REVOKE EXECUTE ON FUNCTION public.admin_care_bridge_events(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_care_bridge_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_care_bridge_events(integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.admin_care_bridge_summary() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_care_bridge_events(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_care_bridge_summary() TO authenticated;