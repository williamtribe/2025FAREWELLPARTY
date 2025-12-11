function EventInfo() {
  return (
    <div className="page">
      <div className="floating-actions">
        <a className="floating-cta info" href="/">
          내 프로필 보기
        </a>
        <a className="floating-cta share" href="/">카톡 로그인 부터!</a>
      </div>

      <div className="header">
        <div>
          <p className="eyebrow">EVENT INFO</p>
          <h1>2025 송년회 안내</h1>
          <p className="muted">
            {" "}
            안녕하세요, 김영진이라고 합니다. <br /> 현재 KAIST를 다니다 휴학해서
            제가 즐기던 게임인 마피아42의 회사에서 일하고 있습니다. <br /> 제
            소중한 분들 및 그들의 소중한 분들, <br /> 1년동안 고생하셨습니다.{" "}
            <br /> 맛있게 먹고, 신나게 놀다 가세요.
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
                  <td>2025년 12월 20일 (토) 오후 6시</td>
                </tr>
                <tr>
                  <th>장소</th>
                  <td>
                    서울 송파구 백제고분로 41길 6-5 302호
                    <br />
                    비윗미 (요리파티룸)
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
                  <td>01</td>
                  <td>테이블 배정: GOAT 테크놀로지 기반</td>
                </tr>
                <tr>
                  <td>02</td>
                  <td>미슐랭 쉐프가 해주는 스테이크 썰기</td>
                </tr>
                <tr>
                  <td>03</td>
                  <td>자유 네트워킹 (비생산적 대화 권장)</td>
                </tr>
                <tr>
                  <td>04</td>
                  <td>주최자 회사 (마피아42) 후원 감사인사</td>
                </tr>
                <tr>
                  <td>05</td>
                  <td>마피아 게임 진행 (테이블 팀전)</td>
                </tr>
                <tr>
                  <td>06</td>
                  <td>노래대결 (테이블별로 1명)</td>
                </tr>
                <tr>
                  <td>07</td>
                  <td>자유게임 (테이블 팀전)</td>
                </tr>
              </tbody>
            </table>
          </div>
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
            원래 무료로 해드리고 싶었는데, 운영비용이 많이 들어서 일부를 받기로
            했습니다. <br />
            정산 대신 행사준비를 돕거나 음료를 가져오셔도 됩니다.
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
    </div>
  );
}

export default EventInfo;
