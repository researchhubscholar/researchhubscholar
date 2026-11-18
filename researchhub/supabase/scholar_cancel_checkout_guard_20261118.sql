-- ResearchHub payment safety patch: deployment requires explicit operator review.
-- Compatible with existing schema; no retroactive changes to purchases or licenses.
-- Safe to apply to the shared Production database after confirming no drift.
BEGIN;

CREATE OR REPLACE FUNCTION public.scholar_cancel_purchase_request(p_request uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  UPDATE public.scholar_purchase_requests
  SET status='cancelled',updated_at=now()
  WHERE id=p_request AND requester_id=auth.uid()
    AND status IN ('requested','approved')
    AND provider_checkout_id IS NULL;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.scholar_cancel_purchase_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scholar_cancel_purchase_request(uuid) TO authenticated;

COMMIT;

-- Read-only verification: must show the safe cancellation function definition.
SELECT pg_get_functiondef('public.scholar_cancel_purchase_request(uuid)'::regprocedure) AS definition;