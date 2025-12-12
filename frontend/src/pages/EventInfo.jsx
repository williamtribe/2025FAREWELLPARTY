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
          <p className="eyebrow">EVENT INFO</p>
          <h1>Fare, Well 2025</h1>
          <p className="muted">
            {" "}
            안녕하세요, 김영진이라고 합니다. <br /> KAIST를 다니다 휴학해서 제가
            즐기던 게임인 마피아42의 회사에서 일하고 있습니다. <br /> 제 소중한
            분들 및 그들의 소중한 분들, <br /> 1년동안 고생하셨습니다. <br />{" "}
            맛있게 먹고, 신나게 놀다 가세요.
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
                    스튜디오 포에트 (저택형 파티룸)
                  </td>
                </tr>
                <tr>
                  <th>드레스코드</th>
                  <td>하고 싶은 대로. 참고로 저는 츄리닝</td>
                </tr>
                <tr>
                  <th>참석자</th>
                  <td>
                    제 친한 분들과 그들의 친한 분들. <br /> 인성은 제가
                    보장합니다.
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
                  <td>후원자들 감사인사 및 테이블 팀전게임</td>
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
                  <td>~11시 반</td>
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
            <h2>참가비</h2>
          </div>
        </div>
        <div className="card">
          <p className="muted">정산 안내</p>
          <p>송년회 이후 인당 2만 원씩 정산을 할 예정입니다.</p>
          <p>
            원래 무료로 해드리고 싶었는데, 대규모 인원 때문에 운영비용이 많이
            들어서 일부를 받기로 했습니다. <br />
          </p>
          <p className="muted">운영비 사용 내역</p>
          <p>
            운영비의 사용 내역은 아래 링크에서 확인하실 수 있습니다. <br />
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
            또한, 공동계좌를 열어서 후원을 받고 있고, 주류의 형태로도 후원을
            받고 있습니다. 후원을 해주신 분들에게는 자신의 서비스를 홍보할 수
            있는 기회 또는 다른 특전이 주어지게 됩니다.
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
