function EventInfo() {
  return (
    <div className="page">
      <div className="floating-actions">
        <a
          className="floating-cta info"
          href="/"
          style={{ textDecoration: "none" }}
        >
          모든 참석자 보기
        </a>
        <a
          className="floating-cta my-intro"
          href="/my-profile"
          style={{ textDecoration: "none" }}
        >
          내 프로필
        </a>
      </div>

      <div className="header">
        <div>
          <p className="eyebrow">EVENT INFO 행사 정보</p>
          <h1>Fare, Well 2025</h1>
          <p className="muted">
            {" "}
            안녕하세요, 김영진이라고 합니다. <br /> 카이스트를 다니다 휴학해서
            제가 즐기던 게임인 마피아42의 회사에서 일하고 있습니다. <br /> 제
            소중한 분들 및 그들의 소중한 분들, <br /> 1년동안 고생하셨습니다.{" "}
            <br /> 맛있게 먹고, 즐겁게 놀다 가세요.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>기본 정보</h2>
          </div>
        </div>
        <div className="card card-compact">
          <div className="table-scroll">
            <table className="info-table">
              <tbody>
                <tr>
                  <th>날짜</th>
                  <td>
                    2025년 12월 20일 (토) 오후 6시부터 11시까지 <br /> (더 일찍
                    혹은 더 늦게 오셔도 됩니다.)
                  </td>
                </tr>
                <tr>
                  <th>장소</th>
                  <td>
                    서울 마포구 와우산로14길 12 2층
                    <br />
                    <a
                      href="https://naver.me/5dAzbG5X"
                      className="link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      스튜디오 포에트 (저택형 파티룸)
                    </a>
                  </td>
                </tr>
                <tr>
                  <th>드레스코드</th>
                  <td>하고 싶은 대로. 참고로 저는 츄리닝</td>
                </tr>
                <tr>
                  <th>참석자</th>
                  <td>
                    제 친한 분들과 그들의 친한 분들. <br /> 실력과 인성은 제가
                    보장합니다!
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>진행 순서</h2>
            <p className="muted">※ 추후 상세 내역이 업데이트될 예정입니다</p>
          </div>
        </div>
        <div className="card">
          <div className="table-scroll">
            <table className="info-table">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>5~6시</td>
                  <td>
                    입장 및 테이블 배정 <br /> GOAT 테크놀로지 기반
                  </td>
                </tr>
                <tr>
                  <td>6~7시</td>
                  <td>
                    미슐랭 쉐프가 해주는 스테이크 썰기 <br /> +테이블끼리
                    친해지기 게임
                  </td>
                </tr>
                <tr>
                  <td>7~8시</td>
                  <td>후원자 감사인사 및 테이블 팀전게임</td>
                </tr>
                <tr>
                  <td>8~9시</td>
                  <td>
                    마피아게임 <br /> *경품 마피아42 공식 굿즈
                  </td>
                </tr>
                <tr>
                  <td>9~11시</td>
                  <td>자유 네트워킹</td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "nowrap" }}>~11시 반</td>
                  <td>퇴장 및 뒷정리</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>참가비 안내</h2>
          </div>
        </div>
        <div className="card">
          <p>인당 2만원의 참석비를 받고 있습니다.</p>
          <p>
            감사한 분들인 만큼 무료로 진행하고 싶었지만,<br/>인원이 늘어감에 따라
            대관비와 식대비가 제가 감당하기 힘든 수준이 되어 일부를 받기로
            했습니다. <br /> 더 나은 식사와 더 좋은 프로그램을 제공하기 위함이니 부디 너른 양해 부탁드리겠습니다.
          </p>
          <p 
            className="muted" 
            style={{ 
              whiteSpace: "nowrap", 
              fontSize: '12px' // 기본 폰트 크기보다 작게 설정 (예: '14px', '0.9em')
            }}
          >
            ※ 운영비 사용 내역은 아래에서 확인하실 수 있습니다.
          </p>
          <p>
            <a
              href="https://docs.google.com/document/d/1tj-n6YULimIUiKwujQUNbaV4fYyJzPRJktBLoyjyy04/edit?usp=sharing"
              className="link"
              target="_blank"
              rel="noreferrer"
            >
              운영비 사용 내역
            </a>
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>후원비</h2>
          </div>
        </div>
        <div className="card">
          <p>
            ▣ 개인적으로 와인 등의 주류를 지참해 행사에 기부해 주시는 경우, 행사 내 이벤트에서 사용이 가능한 경품 추첨권을 드립니다. 즐거운 행사 진행을 위해 많은 참여 부탁드려요. <br/> <br/> ▣ 상기한 계좌를 통해 참가비 외의 후원도 받고 있습니다. 큰 금액이 아니어도 후원이 가능하며, 모든 후원자님들께 행사 내 세션을 통해 전체 참가자에게 자신의 서비스를 홍보할 기회 또는 다른 특전을 드리니 관심이 있으시다면 연락 주세요!
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>문의</h2>
          </div>
        </div>
        <div className="card">
          <p>김영진</p>
          <p>인스타: @williamkim816</p>
          <p>이메일: turtle816@kaist.ac.kr</p>
        </div>
      </section>
    </div>
  );
}

export default EventInfo;
