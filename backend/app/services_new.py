    def upsert_profile(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Upsert a member profile into Supabase."""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            if "updated_at" not in data:
                data["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            logger.info(f"UPSERT PROFILE: kakao_id={data.get('kakao_id')}, name={data.get('name')}")
            result = self.client.table("member_profiles").upsert(data, on_conflict="kakao_id").execute()
            logger.info(f"UPSERT RESULT: {result.data}")
            return {"data": result.data}
        except Exception as e:
            logger.error(f"Error upserting profile for {data.get('kakao_id')}: {e}")
            return {"error": str(e)}

    def update_profile_image(self, kakao_id: str, profile_image_url: str) -> Dict[str, Any]:
        """Update only the profile_image field for an existing user."""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            now = datetime.now(timezone.utc).isoformat()
            result = self.client.table("member_profiles").update({
                "profile_image": profile_image_url,
                "updated_at": now
            }).eq("kakao_id", kakao_id).execute()
            return {"data": result.data}
        except Exception as e:
            error_str = str(e).lower()
            if "profile_image" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                logger.warning(f"profile_image column not found, skipping update for {kakao_id}")
                return {"skipped": True, "reason": "profile_image_column_not_exists"}
            logger.error(f"Error updating profile image for {kakao_id}: {e}")
            return {"error": str(e)}

    def update_fixed_role(self, kakao_id: str, fixed_role: Optional[str]) -> Dict[str, Any]:
        """Set or clear a fixed role for a user (admin only)."""
        if not self.client:
            return {"skipped": True, "reason": "supabase_not_configured"}
        try:
            now = datetime.now(timezone.utc).isoformat()
            result = self.client.table("member_profiles").update({
                "fixed_role": fixed_role,
                "updated_at": now
            }).eq("kakao_id", kakao_id).execute()
            return {"data": result.data, "updated": True}
        except Exception as e:
            error_str = str(e).lower()
            if "fixed_role" in error_str and ("not exist" in error_str or "not find" in error_str or "could not find" in error_str or "pgrst204" in error_str):
                logger.warning(f"fixed_role column not found for {kakao_id}")
                return {"skipped": True, "reason": "fixed_role_column_not_exists"}
            logger.error(f"Error updating fixed_role for {kakao_id}: {e}")
            return {"error": str(e)}
