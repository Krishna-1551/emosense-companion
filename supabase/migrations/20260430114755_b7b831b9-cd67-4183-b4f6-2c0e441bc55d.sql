REVOKE EXECUTE ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_emotion_distribution(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_risk_trend(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_high_risk_feed(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_user_list() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_user_timeline(uuid, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_emotion_distribution(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_risk_trend(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_high_risk_feed(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_timeline(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;