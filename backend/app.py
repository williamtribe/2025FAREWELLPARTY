import os
from functools import wraps
from flask import Flask, Blueprint, request, jsonify, g
from supabase import create_client, Client
import jwt

# --- 환경 변수 및 클라이언트 초기화 ---
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # 서비스 키 사용
supabase: Client = create_client(supabase_url, supabase_key)
jwt_secret = os.environ.get("JWT_SECRET")

app = Flask(__name__)

# --- 인증 데코레이터 ---
def login_required(f):
    """
    요청 헤더의 JWT 토큰을 검증하고, 유효하면 사용자 정보를 g.user에 저장합니다.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if 'authorization' in request.headers:
            try:
                token = request.headers['authorization'].split(" ")[1]
            except IndexError:
                return jsonify({"detail": "잘못된 형식의 토큰입니다."}), 401

        if not token:
            return jsonify({"detail": "인증 토큰이 필요합니다."}), 401

        try:
            # 토큰을 디코딩하여 사용자 정보를 가져옵니다.
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
            g.user = {
                "kakao_id": payload.get("sub"), # 'sub' 클레임에 kakao_id가 있다고 가정
                "is_admin": payload.get("is_admin", False)
            }
        except jwt.ExpiredSignatureError:
            return jsonify({"detail": "토큰이 만료되었습니다."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"detail": "유효하지 않은 토큰입니다."}), 401

        return f(*args, **kwargs)
    return decorated_function

# --- AI 서비스 (Placeholder) ---
def get_mafia_role_from_intro(intro: str) -> dict:
    """
    자기소개를 기반으로 마피아 직업을 분석하는 AI 함수 (가상 구현)
    실제로는 OpenAI API 등을 호출하는 로직이 들어갑니다.
    """
    # 간단한 키워드 기반으로 임시 직업 배정
    if "전략" in intro or "추리" in intro:
        return {"role": "경찰", "team": "시민팀", "reasoning": "전략적이고 추리하는 성향을 보아, 진실을 파헤치는 경찰의 자질이 보입니다."}
    if "심리" in intro or "사람" in intro:
        return {"role": "마담", "team": "마피아팀", "reasoning": "사람의 심리를 파고드는 능력은 마피아팀의 핵심 인재, 마담에게 어울립니다."}
    if "치료" in intro or "돕는" in intro:
        return {"role": "의사", "team": "시민팀", "reasoning": "다른 사람을 돕고자 하는 마음은 밤마다 생명을 구하는 의사의 역할과 일치합니다."}
    
    return {"role": "시민", "team": "시민팀", "reasoning": "다재다능한 당신의 모습에서 묵묵히 자신의 역할을 다하는 평범하지만 위대한 시민의 가능성을 보았습니다."}


# --- MafBTI Blueprint ---
mafbti_bp = Blueprint('mafbti_bp', __name__)

@mafbti_bp.route('/api/mafbti', methods=['POST'])
@login_required
def handle_mafbti():
    data = request.get_json()
    intro = data.get('intro')
    
    if not intro or len(intro.strip()) < 20:
        return jsonify({"detail": "자기소개를 20자 이상 입력해주세요."}), 400

    kakao_id = g.user.get('kakao_id')
    if not kakao_id:
        return jsonify({"detail": "인증 정보가 올바르지 않습니다."}), 401

    try:
        analysis_result = get_mafia_role_from_intro(intro)
        role = analysis_result.get('role')
        team = analysis_result.get('team')
        reasoning = analysis_result.get('reasoning')

        db_data = {
            "kakao_id": kakao_id,
            "intro": intro,
            "role": role,
            "team": team,
            "reasoning": reasoning
        }
        supabase.table('mafbti_results').upsert(db_data, on_conflict='kakao_id').execute()

        return jsonify(analysis_result), 200

    except Exception as e:
        print(f"MafBTI 처리 중 오류 발생: {e}")
        return jsonify({"detail": "서버에서 분석 중 오류가 발생했습니다."}), 500

# --- 메인 앱에 Blueprint 등록 및 실행 ---
app.register_blueprint(mafbti_bp)

# 여기에 다른 Blueprint(예: 프로필, 관리자 기능 등)들도 등록할 수 있습니다.

if __name__ == '__main__':
    # vite.config.js의 프록시 설정에 맞춰 8000번 포트에서 실행
    app.run(host='0.0.0.0', port=8000, debug=True, use_reloader=True, reloader_type="stat")
