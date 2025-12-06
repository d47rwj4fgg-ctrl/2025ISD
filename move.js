/**
 * DOMContentLoaded イベント
 */
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    //  ▼ 0. ヘルパー関数
    // ==========================================

    // 時間変換
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // 現在の状況判定
    function calculateRoomStatus(schedule) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes(); 
        const currentDay = now.getDay(); 

        const todaysSchedule = schedule.filter(cls => {
            return cls.day === undefined || cls.day === currentDay;
        });

        let status = "available";
        let statusText = "利用可能";
        let statusColor = "green";
        let userText = "(空室)";
        let timeMessage = "本日の授業は終了しました";

        todaysSchedule.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

        let foundCurrentClass = false;

        for (let i = 0; i < todaysSchedule.length; i++) {
            const cls = todaysSchedule[i];
            const startMin = timeToMinutes(cls.start);
            const endMin = timeToMinutes(cls.end);

            if (currentMinutes >= startMin && currentMinutes < endMin) {
                status = "occupied";
                statusText = "授業中";
                statusColor = "red";
                userText = cls.title;
                const diff = endMin - currentMinutes;
                timeMessage = `${cls.end} まで (${diff}分後終了)`;
                foundCurrentClass = true;
                break;
            }
        }

        if (!foundCurrentClass) {
            for (let i = 0; i < todaysSchedule.length; i++) {
                const cls = todaysSchedule[i];
                const startMin = timeToMinutes(cls.start);
                if (currentMinutes < startMin) {
                    const diff = startMin - currentMinutes;
                    timeMessage = `次の授業まで ${diff}分 (${cls.start}開始)`;
                    break;
                }
            }
        }
        return { status, statusText, statusColor, userText, timeMessage };
    }

    // タイムライン表生成
    function generateTimelineHTML(schedule) {
        const days = ["月", "火", "水", "木", "金"];
        const periods = [
            { name: "1限", start: "08:50" },
            { name: "2限", start: "10:30" },
            { name: "3限", start: "13:00" },
            { name: "4限", start: "14:40" },
            { name: "5限", start: "16:20" }
        ];

        let html = '<div class="timeline-container"><table class="timeline-table">';
        html += '<thead><tr><th>曜日</th>';
        periods.forEach(p => {
            html += `<th>${p.name}<br><span style="font-size:0.7em">${p.start}~</span></th>`;
        });
        html += '</tr></thead><tbody>';

        days.forEach((dayName, index) => {
            const dayNum = index + 1;
            html += `<tr><td class="day-header">${dayName}</td>`;
            periods.forEach(p => {
                const foundClass = schedule.find(s => s.day === dayNum && s.start === p.start);
                if (foundClass) {
                    html += `<td class="status-occupied">${foundClass.title}</td>`;
                } else {
                    html += `<td class="status-free">○</td>`;
                }
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        return html;
    }

    // 口コミ保存・取得
    function getLocalReviews(roomId) {
        const storedReviews = localStorage.getItem('reviews_' + roomId);
        return storedReviews ? JSON.parse(storedReviews) : [];
    }
    function saveLocalReview(roomId, text) {
        const reviews = getLocalReviews(roomId);
        reviews.push(text);
        localStorage.setItem('reviews_' + roomId, JSON.stringify(reviews));
    }


    // ==========================================
    //  ▼ 1. メインビュー（ページ）切り替え
    // ==========================================
    const allNavLinks = document.querySelectorAll('.nav-link');
    const searchLink = document.getElementById('nav-search');
    const floorLinks = document.querySelectorAll('.floor-link');
    const mapView = document.getElementById('map-view');
    const searchView = document.getElementById('search-view');
    const allFloorMaps = document.querySelectorAll('.floor-map-content');
    const mapTitle = document.getElementById('map-floor-title');
    
    // 検索画面の要素
    const searchKeyword = document.getElementById('search-keyword');
    const searchEquip = document.getElementById('search-equip');
    const searchStatus = document.getElementById('search-status');
    const searchResultsArea = document.getElementById('search-results-area');
    // 初期カテゴリ表示用のHTMLを保存しておく (存在チェック付き)
    let initialCategoriesHTML = "";
    const initialCategoriesElem = document.getElementById('initial-categories');
    if (initialCategoriesElem) {
        initialCategoriesHTML = initialCategoriesElem.outerHTML;
    }

    // 「検索」クリック（リセット機能付き）
    if(searchLink) {
        searchLink.addEventListener('click', () => {
            allNavLinks.forEach(link => link.classList.remove('active'));
            searchLink.classList.add('active');
            if(searchView) searchView.classList.add('active');
            if(mapView) mapView.classList.remove('active');

            // 検索状態をリセット
            if(searchKeyword) searchKeyword.value = "";
            if(searchEquip) searchEquip.value = "";
            if(searchStatus) searchStatus.value = "";
            if(searchResultsArea && initialCategoriesHTML) {
                searchResultsArea.innerHTML = initialCategoriesHTML;
                // カテゴリボタンのイベントを再登録
                attachCategoryEvents();
            }
        });
    }

    // 「階層」クリック
    floorLinks.forEach(link => {
        link.addEventListener('click', () => {
            allNavLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            if(mapView) mapView.classList.add('active');
            if(searchView) searchView.classList.remove('active');

            const floorName = link.dataset.floor;
            if (mapTitle) mapTitle.textContent = `${floorName} フロアマップ`;

            allFloorMaps.forEach(map => map.classList.remove('active'));
            const targetMap = document.getElementById('map-' + floorName);
            if (targetMap) targetMap.classList.add('active');
            
            // リセット処理
            const detailsPrompt = document.getElementById('details-prompt');
            const dynamicContainer = document.getElementById('dynamic-details-container');
            if(dynamicContainer) dynamicContainer.innerHTML = "";
            if(detailsPrompt) detailsPrompt.classList.add('active');
            document.querySelectorAll('.classroom').forEach(r => r.classList.remove('selected'));
        });
    });


    // ==========================================
    //  ▼ 2. 検索機能
    // ==========================================
    const executeSearchBtn = document.getElementById('execute-search-btn');

    // 検索実行関数
    function executeSearch() {
        const keyword = searchKeyword ? searchKeyword.value.trim() : "";
        const equip = searchEquip ? searchEquip.value : "";
        const statusReq = searchStatus ? searchStatus.value : "";

        let resultsHTML = '<h2>検索結果</h2><div class="map-right-side" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap:10px;">';
        let count = 0;

        for (const roomId in roomDatabase) {
            const data = roomDatabase[roomId];
            if (keyword && !data.name.includes(keyword)) continue;
            if (equip && !data.equipment.includes(equip)) continue;
            
            const currentStatus = calculateRoomStatus(data.schedule || []);
            if (statusReq === 'available' && currentStatus.status !== 'available') continue;

            resultsHTML += `
                <div class="classroom" data-room-id="${roomId}" style="display:flex; flex-direction:column; height:80px; justify-content:center;">
                    <span>${data.name}</span>
                    <span style="font-size:0.7em; color:${currentStatus.statusColor}">
                        ${currentStatus.statusText}
                    </span>
                </div>
            `;
            count++;
        }
        resultsHTML += '</div>';

        if (count === 0) {
            if(searchResultsArea) searchResultsArea.innerHTML = '<h2>検索結果</h2><p>条件に一致する教室は見つかりませんでした。</p>';
        } else {
            if(searchResultsArea) {
                searchResultsArea.innerHTML = resultsHTML;
                attachClickEventToNewButtons();
            }
        }
    }

    if (executeSearchBtn) {
        executeSearchBtn.addEventListener('click', executeSearch);
    }

    // カテゴリボタンをクリックしたときの動作
    function attachCategoryEvents() {
        const categoryCards = document.querySelectorAll('.category-card');
        categoryCards.forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.searchType;
                const value = card.dataset.searchValue;

                // フォームに値をセット
                if (type === 'status') {
                    if(searchStatus) searchStatus.value = value;
                    if(searchEquip) searchEquip.value = ""; 
                } else if (type === 'equip') {
                    if(searchEquip) searchEquip.value = value;
                    if(searchStatus) searchStatus.value = "";
                }
                if(searchKeyword) searchKeyword.value = "";

                // 検索実行
                executeSearch();
            });
        });
    }
    
    // 初期ロード時にもカテゴリエベントを登録
    attachCategoryEvents();


    // 検索結果ボタンへのイベント付与
    function attachClickEventToNewButtons() {
        if(!searchResultsArea) return;
        const newButtons = searchResultsArea.querySelectorAll('.classroom');
        newButtons.forEach(room => {
            room.addEventListener('click', () => {
                const roomId = room.dataset.roomId;
                
                // 詳細画面へ遷移 (1Fを表示状態にして詳細を出す)
                if(mapView) mapView.classList.add('active');
                if(searchView) searchView.classList.remove('active');
                allNavLinks.forEach(l => l.classList.remove('active'));
                
                // とりあえず1Fをアクティブにする
                // roomDataに階層情報があればそれを使えますが、今回は簡易的に1Fへ
                // 本来は roomId から階層を推測するロジック (例: 301 -> 3F) があるとベター
                let targetFloor = "1F";
                const firstDigit = roomId.charAt(0);
                if(["1","2","3","4","5"].includes(firstDigit)) {
                    targetFloor = firstDigit + "F";
                }
                
                // サイドバーの更新
                const floorLink = document.querySelector(`.floor-link[data-floor="${targetFloor}"]`);
                if(floorLink) {
                    floorLink.classList.add('active');
                    if(mapTitle) mapTitle.textContent = `${targetFloor} フロアマップ`;
                }

                // マップ表示の切り替え
                allFloorMaps.forEach(map => map.classList.remove('active'));
                const targetMap = document.getElementById('map-' + targetFloor);
                if (targetMap) targetMap.classList.add('active');

                // 詳細表示
                showRoomDetails(roomId);
            });
        });
    }


    // ==========================================
    //  ▼ 3. 教室詳細表示 (共通関数化)
    // ==========================================
    const classrooms = document.querySelectorAll('.classroom');
    const detailsPrompt = document.getElementById('details-prompt');
    const dynamicContainer = document.getElementById('dynamic-details-container');

    // 詳細を表示するメインロジック
    function showRoomDetails(roomId) {
        const data = roomDatabase[roomId];
        if (!data) return;

        if(detailsPrompt) detailsPrompt.classList.remove('active');

        // 状態取得
        const currentStatus = calculateRoomStatus(data.schedule || []);
        const timelineTable = generateTimelineHTML(data.schedule || []);
        
        // 口コミ取得
        const localReviews = getLocalReviews(roomId);
        const allReviews = (data.reviews || []).concat(localReviews);
        let reviewsListHtml = allReviews.map(r => `<li>${r}</li>`).join('');
        if (allReviews.length === 0) {
            reviewsListHtml = "<li>まだ口コミはありません。最初の投稿者になりましょう！</li>";
        }

        const htmlContent = `
            <div class="room-details-content active">
                <h3>${data.name}</h3>
                <div class="tabs">
                    <button class="tab-button active" onclick="switchTab(this, 'info')">教室情報</button>
                    <button class="tab-button" onclick="switchTab(this, 'reviews')">口コミ</button>
                </div>

                <div id="tab-info" class="tab-content active">
                    <h4>教室情報</h4>
                    <strong>状況:</strong> 
                    <span style="color: ${currentStatus.statusColor}; font-weight:bold; font-size:1.1em;">
                        ${currentStatus.statusText}
                    </span> 
                    (${currentStatus.timeMessage})<br>
                    <strong>設備:</strong> ${data.equipment || "情報なし"}<br>
                    <strong>使用者:</strong> ${currentStatus.userText}<br>
                    <hr>
                    <h4>週間スケジュール</h4>
                    ${timelineTable}
                </div>

                <div id="tab-reviews" class="tab-content">
                    <h4>口コミ一覧・投稿</h4>
                    <div style="background:#f9f9f9; padding:10px; border-radius:5px; margin-bottom:15px;">
                        <input type="text" id="review-input" placeholder="口コミを入力..." style="width:70%; padding:5px;">
                        <button id="submit-review-btn" style="padding:5px 10px;">投稿</button>
                    </div>
                    <ul id="reviews-list">${reviewsListHtml}</ul>
                </div>
            </div>
        `;

        if(dynamicContainer) dynamicContainer.innerHTML = htmlContent;

        // 口コミ投稿イベント設定
        const submitBtn = document.getElementById('submit-review-btn');
        const inputField = document.getElementById('review-input');
        const listField = document.getElementById('reviews-list');

        if(submitBtn) {
            submitBtn.addEventListener('click', () => {
                const text = inputField.value;
                if(text.trim() === "") {
                    alert("文字を入力してください");
                    return;
                }
                saveLocalReview(roomId, text);
                const newLi = document.createElement('li');
                newLi.textContent = text;
                listField.appendChild(newLi);
                inputField.value = "";
            });
        }
    }

    // マップ上の教室クリックイベント
    classrooms.forEach(room => {
        room.addEventListener('click', () => {
            const roomId = room.dataset.roomId;
            classrooms.forEach(r => r.classList.remove('selected'));
            room.classList.add('selected');
            showRoomDetails(roomId);
        });
    });


    // ==========================================
    //  ▼ 4. タブ切り替え (グローバル関数)
    // ==========================================
    window.switchTab = function(button, tabName) {
        const parentContainer = button.closest('.room-details-content');
        parentContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        parentContainer.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        if (tabName === 'info') {
            parentContainer.querySelector('#tab-info').classList.add('active');
        } else if (tabName === 'reviews') {
            parentContainer.querySelector('#tab-reviews').classList.add('active');
        }
    };


    // ==========================================
    //  ▼ 5. サイト全体の口コミ機能
    // ==========================================
    const siteReviewList = document.getElementById('site-reviews-list');
    const siteReviewInput = document.getElementById('site-review-input');
    const siteReviewSubmit = document.getElementById('site-review-submit');
    const STORAGE_KEY_SITE = 'site_global_reviews';

    function loadSiteReviews() {
        const stored = localStorage.getItem(STORAGE_KEY_SITE);
        const reviews = stored ? JSON.parse(stored) : [];
        if(siteReviewList) {
            siteReviewList.innerHTML = "";
            if (reviews.length === 0) {
                siteReviewList.innerHTML = "<li style='text-align:center; color:#ccc;'>まだ投稿はありません。</li>";
            } else {
                reviews.slice().reverse().forEach(text => {
                    const li = document.createElement('li');
                    li.textContent = text;
                    siteReviewList.appendChild(li);
                });
            }
        }
    }

    if (siteReviewSubmit) {
        siteReviewSubmit.addEventListener('click', () => {
            const text = siteReviewInput.value.trim();
            if (!text) return;
            const stored = localStorage.getItem(STORAGE_KEY_SITE);
            const reviews = stored ? JSON.parse(stored) : [];
            reviews.push(text);
            localStorage.setItem(STORAGE_KEY_SITE, JSON.stringify(reviews));
            siteReviewInput.value = "";
            loadSiteReviews();
        });
    }

    // 初期読み込み
    loadSiteReviews();

}); // DOMContentLoaded 終了
