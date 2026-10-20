'use strict';

(() => {
    const $ = id => document.getElementById(id);

    function node(tag, className = '', text = '') {
        const item = document.createElement(tag);
        item.className = className;
        item.textContent = String(text);
        return item;
    }

    function showError(error) {
        alert(error?.message || 'تعذر تنفيذ العملية. تحققي من الاتصال.');
    }

    if (!window.supabase) {
        alert('تعذر تحميل خدمة الاتصال. تحققي من الإنترنت ثم حدّثي الصفحة.');
        return;
    }

    const db = window.supabase.createClient(
        'https://mriquvzolemesizhmluj.supabase.co',
        'sb_publishable_WxaWBu4GwZLDKCJ0FChCxA_vtofg4oX'
    );

    let books = [];
    let booksReady = false;
    let admin = false;
    let currentUser = null;
    let authVersion = 0;
    let records = [];
    let loadingRecords = false;
    let loadingBooks = false;

    let refreshVisitOptions = () => {};
    let renderGallery = () => {};
    let renderRecords = () => {};
    let updateAdminView = () => {};

    function normalize(value) {
        return String(value ?? '')
            .toLowerCase()
            .replace(/[أإآٱ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
            .trim();
    }

    function formatDate(value) {
        return new Date(value).toLocaleString('ar-SA', {
            timeZone: 'Asia/Riyadh',
            calendar: 'gregory',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function isActive(row) {
        return (
            ['reading', 'borrowing'].includes(row.purpose) &&
            row.completed_at === null
        );
    }

    function bookTitle(id) {
        return books.find(book => book.id === id)?.title || 'كتاب';
    }

    function purposeText(row) {
        if (row.purpose === 'other') {
            return 'شيء آخر — ' + row.details;
        }

        const purpose = row.purpose === 'reading'
            ? 'قراءة داخل المكتبة'
            : 'استعارة';

        return purpose + ' — ' + bookTitle(row.book_id);
    }

    // حالة الاتصال
    const connection = node('p', 'muted', 'جارٍ تحميل بيانات المكتبة...');
    connection.id = 'cloud-status';
    connection.setAttribute('role', 'status');
    document.querySelector('main')?.prepend(connection);

    async function loadBooks() {
        if (loadingBooks) return;

        loadingBooks = true;

        try {
            const { data, error } = await db
                .from('library_books')
                .select('*')
                .order('id');

            if (error) throw error;

            books = data;
            booksReady = true;

            connection.textContent =
                'آخر تحديث: ' + formatDate(new Date());

            renderGallery();
            refreshVisitOptions();
        } catch (error) {
            booksReady = false;
            connection.textContent =
                'تعذر تحديث البيانات. تحققي من الاتصال بالإنترنت.';

            refreshVisitOptions();
        } finally {
            loadingBooks = false;
        }
    }

    // لا تُطلب بيانات الطلاب إلا بعد التأكد من صلاحية المسؤولة.
    async function loadRecords() {
        if (!admin || loadingRecords || !$('records-container')) return;

        loadingRecords = true;
        const version = authVersion;

        try {
            const all = [];
            const size = 200;

            for (let start = 0; ; start += size) {
                const { data, error } = await db
                    .from('library_visits')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })
                    .range(start, start + size - 1);

                if (error) throw error;
                if (version !== authVersion || !admin) return;

                all.push(...data);

                if (data.length < size) break;
            }

            // إزالة أي تكرار محتمل عند وصول تسجيل جديد أثناء التحميل
            records = [...new Map(
                all.map(row => [row.id, row])
            ).values()];

            renderRecords();
        } catch (error) {
            if (version !== authVersion || !admin) return;

            records = [];

            $('records-container').replaceChildren(
                node('p', 'muted', 'تعذر تحميل السجلات: ' + error.message)
            );

            $('record-count').textContent = 'تعذر التحميل';
            $('no-records').hidden = true;
        } finally {
            loadingRecords = false;
        }
    }

    // التحقق من أن الحساب مسجّل في جدول المسؤولات
    async function checkAdmin() {
        const version = ++authVersion;

        admin = false;
        currentUser = null;
        records = [];
        updateAdminView();

        try {
            const { data: { session }, error } = await db.auth.getSession();
            if (error) throw error;
            if (version !== authVersion) return;

            if (!session) return;

            currentUser = session.user;

            const { data, error: permissionError } = await db
                .from('library_admins')
                .select('user_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (permissionError) throw permissionError;
            if (version !== authVersion) return;

            admin = Boolean(data);
            updateAdminView();

            if (admin && !$('view-librarian')?.hidden) {
                await loadRecords();
            }
        } catch (error) {
            if (version !== authVersion) return;

            admin = false;
            updateAdminView();

            if ($('admin-message')) {
                $('admin-message').textContent =
                    'تعذر التحقق من الحساب. حاولي تسجيل الدخول مجددًا.';
            }
        }
    }

    // معرض الكتب
    function initializeGallery() {
        const stats = document.querySelector('.book-stats');

        [
            ['reading-count', 'قيد القراءة داخل المكتبة'],
            ['borrowed-count', 'الكتب المستعارة']
        ].forEach(([id, title]) => {
            if ($(id)) return;

            const card = node('div', 'stat-card');
            const count = node('strong', '', '0');
            count.id = id;

            card.append(node('span', '', title), count);
            stats.append(card);
        });

        const note = document.querySelector('.gallery-heading + p.muted');

        if (note) {
            note.textContent =
                'الأعداد المتاحة تُحدّث من قاعدة بيانات المكتبة.';
        }

        renderGallery = () => {
            const categorySelect = $('book-category');
            const selectedCategory = categorySelect.value;
            const categories = [...new Set(
                books.map(book => book.category)
            )];

            categorySelect.replaceChildren(
                new Option('جميع التصنيفات', '')
            );

            categories.forEach(category => {
                categorySelect.add(new Option(category, category));
            });

            categorySelect.value = categories.includes(selectedCategory)
                ? selectedCategory
                : '';

            const sum = key => books.reduce(
                (total, book) => total + Number(book[key]),
                0
            );

            $('titles-count').textContent = books.length;
            $('copies-count').textContent = sum('total_copies');
            $('categories-count').textContent = categories.length;
            $('reading-count').textContent = sum('reading_copies');
            $('borrowed-count').textContent = sum('borrowed_copies');

            const search = normalize($('book-search').value);

            const filtered = books.filter(book => (
                normalize(book.title).includes(search) &&
                (
                    !categorySelect.value ||
                    book.category === categorySelect.value
                )
            ));

            const grid = $('books-grid');
            grid.replaceChildren();

            filtered.forEach(book => {
                const card = node('article', 'book-card');
                const stage = node('div', 'book-stage');
                const image = node('img', 'book-photo');

                image.src = book.image;
                image.alt = 'غلاف ' + book.title;
                image.loading = 'lazy';

                image.addEventListener('error', () => {
                    stage.replaceChildren(node('span', 'muted', book.title));
                }, { once: true });

                stage.append(image);

                card.append(
                    stage,
                    node('span', 'book-category', book.category),
                    node('h3', '', book.title)
                );

                [
                    ['المتاح الآن', book.available_copies],
                    ['إجمالي النسخ', book.total_copies],
                    ['قيد القراءة', book.reading_copies],
                    ['مستعار', book.borrowed_copies]
                ].forEach(([title, value]) => {
                    const line = node('div', 'book-count');

                    line.append(
                        node('span', '', title),
                        node('strong', '', value)
                    );

                    card.append(line);
                });

                grid.append(card);
            });

            $('books-result-count').textContent =
                filtered.length + ' عنوان';

            $('no-books').hidden = filtered.length > 0;
        };

        $('book-search').addEventListener('input', renderGallery);
        $('book-category').addEventListener('change', renderGallery);
    }

    // التوقيع مع المحافظة عليه عند تغيير حجم الشاشة
    function initializeSignature() {
        const canvas = $('sig-canvas');

        if (!canvas) {
            return {
                valid: () => true,
                data: () => '',
                clear() {},
                resize() {}
            };
        }

        const ctx = canvas.getContext('2d');

        let strokes = [];
        let current = null;
        let pointer = null;

        canvas.style.touchAction = 'none';

        function draw() {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#3e2723';
            ctx.fillStyle = '#3e2723';

            strokes.forEach(stroke => {
                const first = stroke[0];

                ctx.beginPath();
                ctx.arc(first.x * width, first.y * height, 1.25, 0, Math.PI * 2);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(first.x * width, first.y * height);

                stroke.slice(1).forEach(point => {
                    ctx.lineTo(point.x * width, point.y * height);
                });

                ctx.stroke();
            });

            if ($('sig-placeholder')) {
                $('sig-placeholder').hidden = strokes.length > 0;
            }
        }

        function resize() {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const ratio = Math.min(window.devicePixelRatio || 1, 2);

            canvas.width = Math.round(rect.width * ratio);
            canvas.height = Math.round(rect.height * ratio);
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

            draw();
        }

        function position(event) {
            const rect = canvas.getBoundingClientRect();

            return {
                x: Math.max(0, Math.min(1,
                    (event.clientX - rect.left) / rect.width)),
                y: Math.max(0, Math.min(1,
                    (event.clientY - rect.top) / rect.height))
            };
        }

        canvas.addEventListener('pointerdown', event => {
            if (pointer !== null || event.button !== 0) return;

            event.preventDefault();
            pointer = event.pointerId;
            canvas.setPointerCapture(pointer);

            current = [position(event)];
            strokes.push(current);
            draw();
        });

        canvas.addEventListener('pointermove', event => {
            if (event.pointerId !== pointer || !current) return;

            event.preventDefault();
            current.push(position(event));
            draw();
        });

        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
            canvas.addEventListener(type, event => {
                if (event.pointerId === pointer) {
                    pointer = null;
                    current = null;
                }
            });
        });

        function clear() {
            strokes = [];
            current = null;
            pointer = null;
            draw();
        }

        $('clear-signature')?.addEventListener('click', clear);

        window.addEventListener('resize', resize);

        if ('ResizeObserver' in window) {
            new ResizeObserver(resize).observe(canvas);
        }

        requestAnimationFrame(resize);

        return {
            valid: () => strokes.length > 0,
            data: () => canvas.toDataURL('image/png'),
            clear,
            resize
        };
    }

    function initializeVisits() {
        const form = $('student-form');
        const purpose = $('visit-purpose');
        const details = $('need-details');
        const signature = initializeSignature();

        let sending = false;
        let pendingRequest = null;

        // قائمة الكتب
        let bookBox = $('visit-book-box');
        let bookSelect = $('visit-book');

        if (!bookBox || !bookSelect) {
            bookBox?.remove();

            bookBox = node('div', 'field');
            bookBox.id = 'visit-book-box';

            const label = node('label', '', 'اختر الكتاب:');
            label.htmlFor = 'visit-book';

            bookSelect = node('select');
            bookSelect.id = 'visit-book';

            bookBox.append(label, bookSelect);
            purpose.closest('.field').after(bookBox);
        }

        refreshVisitOptions = () => {
            const previous = bookSelect.value;
            const needsBook = ['reading', 'borrowing'].includes(purpose.value);

            bookBox.hidden = !needsBook;
            bookSelect.required = needsBook;
            bookSelect.disabled = !needsBook || !booksReady;

            $('need-details-box').hidden = purpose.value !== 'other';
            details.disabled = purpose.value !== 'other';
            details.required = purpose.value === 'other';

            $('need-details-label').textContent = 'اكتب احتياجك:';
            details.placeholder = 'وضّح الخدمة أو الاحتياج الذي تريده...';

            // أثناء إعادة محاولة طلب سابق، نحتفظ ببياناته كما هي.
            if (pendingRequest) return;

            bookSelect.replaceChildren(
                new Option(
                    booksReady ? 'اختر الكتاب' : 'بانتظار الاتصال...',
                    ''
                )
            );

            books.forEach(book => {
                const option = new Option(
                    book.title + ' — المتاح: ' + book.available_copies,
                    String(book.id)
                );

                option.disabled = book.available_copies <= 0;
                bookSelect.add(option);
            });

            const oldOption = [...bookSelect.options].find(option => (
                option.value === previous && !option.disabled
            ));

            bookSelect.value = oldOption ? previous : '';
        };

        purpose.addEventListener('change', refreshVisitOptions);

        // نموذج دخول المسؤولة
        const librarian = $('view-librarian');
        const dashboard = librarian.querySelector('.panel');

        const loginPanel = node('section', 'panel cloud-login');
        loginPanel.id = 'admin-login-panel';

        loginPanel.innerHTML = `
            <h2>دخول مسؤولة المكتبة</h2>
            <form id="admin-login-form">
                <div class="field">
                   <label for="admin-username">اسم المستخدم:</label>
        <input
    id="admin-username"
    type="text"
    placeholder="اسم مستخدم مسؤولة المكتبة"
    autocomplete="username"
    required
               >
                </div>
                <div class="field">
                    <label for="admin-password">كلمة المرور:</label>
                    <input id="admin-password" type="password"
                        autocomplete="current-password" required>
                </div>
                <button type="submit" class="primary-button"
                    id="admin-login-button">تسجيل الدخول</button>
            </form>
            <p id="admin-message" class="muted" role="status"></p>
        `;

        librarian.prepend(loginPanel);

        const accountBar = node('div', 'panel cloud-account');
        const accountText = node('span');
        const logout = node('button', 'danger-button', 'تسجيل الخروج');
        logout.type = 'button';

        accountBar.append(accountText, logout);
        loginPanel.after(accountBar);

        updateAdminView = () => {
            loginPanel.hidden = admin;
            accountBar.hidden = !currentUser;

            dashboard.hidden = !admin;
            $('records-container').hidden = !admin;

            accountText.textContent = 'مرحبًا، مسؤولة المكتبة';

            if (!admin) {
                $('records-container').replaceChildren();
                $('record-count').textContent = '0 سجلات';
                $('no-records').hidden = true;

                $('admin-message').textContent = currentUser
                    ? 'هذا الحساب غير معتمد كمسؤولة مكتبة.'
                    : '';
            }
        };

        $('admin-login-form').addEventListener('submit', async event => {
            event.preventDefault();

            const button = $('admin-login-button');
            button.disabled = true;
            $('admin-message').textContent = 'جارٍ تسجيل الدخول...';

            try {
const { data, error } = await db.functions.invoke('library-login', {
    body: {
        username: $('admin-username').value.trim(),
        password: $('admin-password').value
    }
});

if (error) throw error;

if (!data?.access_token || !data?.refresh_token) {
    throw new Error('لم يتم استلام بيانات تسجيل الدخول.');
}

const { error: sessionError } = await db.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token
});

if (sessionError) throw sessionError;


                $('admin-password').value = '';
                await checkAdmin();
            } catch (error) {
                $('admin-message').textContent =
                    'تعذر الدخول. تحققي من البريد وكلمة المرور والاتصال.';
            } finally {
                button.disabled = false;
            }
        });

        logout.addEventListener('click', async () => {
            logout.disabled = true;

            try {
                const { error } = await db.auth.signOut();
                if (error) throw error;

                await checkAdmin();
            } catch (error) {
                showError(error);
            } finally {
                logout.disabled = false;
            }
        });

        function switchTab(student) {
            $('view-student').hidden = !student;
            librarian.hidden = student;

            $('tab-student').classList.toggle('active', student);
            $('tab-librarian').classList.toggle('active', !student);

            $('tab-student').setAttribute('aria-pressed', String(student));
            $('tab-librarian').setAttribute('aria-pressed', String(!student));

            if (student) {
                refreshVisitOptions();
                requestAnimationFrame(signature.resize);
            } else {
                checkAdmin();
            }
        }

        $('tab-student').addEventListener('click', () => switchTab(true));
        $('tab-librarian').addEventListener('click', () => switchTab(false));

        window.addEventListener('hashchange', () => {
            switchTab(location.hash !== '#librarian');
        });

        // تنبيه نتيجة الطلب عند انقطاع الاتصال
        const retryMessage = node('p', 'muted');
        retryMessage.hidden = true;
        retryMessage.setAttribute('role', 'status');
        $('submit-button').before(retryMessage);

        function lockFields(locked) {
            form.querySelectorAll('input, textarea, select').forEach(input => {
                input.disabled = locked;
            });

            if ($('clear-signature')) {
                $('clear-signature').disabled = locked;
            }

            if ($('sig-canvas')) {
                $('sig-canvas').style.pointerEvents = locked ? 'none' : '';
            }

            if (!locked) refreshVisitOptions();
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (sending) return;

            if (!pendingRequest) {
                if (!form.reportValidity()) return;

                const name = $('student-name').value.trim();
                const number = $('student-id').value.trim();
                const kind = purpose.value;
                const other = details.value.trim();

                if (!name || !number) {
                    alert('أكملي الاسم والرقم الأكاديمي.');
                    return;
                }

                if (!['reading', 'borrowing', 'other'].includes(kind)) {
                    alert('اختاري الغرض من الزيارة.');
                    return;
                }

                if (kind === 'other' && !other) {
                    alert('اكتبي تفاصيل الاحتياج.');
                    return;
                }

                if (kind !== 'other' && (!booksReady || !bookSelect.value)) {
                    alert('انتظري تحميل الكتب ثم اختاري كتابًا متاحًا.');
                    return;
                }

                if (!signature.valid()) {
                    alert('يرجى التوقيع قبل حفظ التسجيل.');
                    return;
                }

                if (!crypto.randomUUID) {
                    alert('افتحي الموقع عبر HTTPS أو Live Server.');
                    return;
                }

                pendingRequest = {
                    p_id: crypto.randomUUID(),
                    p_student_name: name,
                    p_academic_number: number,
                    p_purpose: kind,
                    p_book_id: kind === 'other'
                        ? null
                        : Number(bookSelect.value),
                    p_details: kind === 'other' ? other : '',
                    p_signature: signature.data()
                };
            }

            sending = true;
            lockFields(true);
            $('submit-button').disabled = true;
            $('submit-button').textContent = 'جارٍ الحفظ...';

            try {
                const { error } = await db.rpc(
                    'library_register_visit',
                    pendingRequest
                );

                if (error) throw error;

                pendingRequest = null;
                retryMessage.hidden = true;

                const message = document.querySelector(
                    '#success-modal .modal-content p'
                );

                if (message) {
                    message.textContent =
                        'تم حفظ زيارتك في قاعدة بيانات المكتبة بنجاح.';
                }

                $('success-modal').hidden = false;
                $('close-success').focus();

                await loadBooks();
            } catch (error) {
                // خطأ تحقق مؤكد من قاعدة البيانات: لم تُحفظ العملية.
                const databaseRejected = (
                    error.code === 'P0001' ||
                    error.code?.startsWith('22') ||
                    error.code?.startsWith('23')
                );

                if (databaseRejected) {
                    pendingRequest = null;
                    retryMessage.hidden = true;
                    lockFields(false);
                    showError(error);
                } else {
                    // نكرر نفس الطلب حتى لا تُخصم النسخة مرتين
                    retryMessage.textContent =
                        'لم يصل تأكيد الحفظ. تحققي من الإنترنت ثم اضغطي ' +
                        'إعادة محاولة نفس التسجيل. لا تحدّثي الصفحة الآن.';

                    retryMessage.hidden = false;
                }

                $('submit-button').disabled = false;
            } finally {
                sending = false;

                $('submit-button').textContent = pendingRequest
                    ? 'إعادة محاولة نفس التسجيل'
                    : 'إرسال وحفظ تسجيل الزيارة';
            }
        });

        function closeSuccess() {
            $('success-modal').hidden = true;
            form.reset();
            pendingRequest = null;
            signature.clear();
            lockFields(false);
            $('submit-button').disabled = false;
            $('student-name').focus();
        }

        $('close-success').addEventListener('click', closeSuccess);

        $('success-modal').addEventListener('keydown', event => {
            if (event.key === 'Escape') closeSuccess();

            if (event.key === 'Tab') {
                event.preventDefault();
                $('close-success').focus();
            }
        });

        async function runAction(button, procedure, parameters) {
            button.disabled = true;

            try {
                const { error } = await db.rpc(procedure, parameters);
                if (error) throw error;

                await loadBooks();
                await loadRecords();
            } catch (error) {
                showError(error);
            } finally {
                button.disabled = false;
            }
        }

        renderRecords = () => {
            if (!admin) return;

            const query = normalize($('search-input').value);

            const filtered = records.filter(row => (
                [
                    row.student_name,
                    row.academic_number,
                    purposeText(row)
                ].some(value => normalize(value).includes(query))
            ));

            const container = $('records-container');
            container.replaceChildren();

            $('record-count').textContent = filtered.length + ' سجلات';
            $('no-records').hidden = filtered.length > 0;

            $('empty-title').textContent = records.length
                ? 'لا توجد نتائج تطابق البحث'
                : 'لا توجد سجلات زيارات حتى الآن';

            filtered.forEach(row => {
                const card = node('article', 'record-card');

                card.append(
                    node('h3', '', row.student_name),
                    node('p', 'record-number',
                        'الرقم الأكاديمي: ' + row.academic_number),
                    node('p', 'record-needs', purposeText(row)),
                    node('p', 'record-date',
                        'التسجيل: ' + formatDate(row.created_at))
                );

                if (
                    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(
                        row.signature || ''
                    )
                ) {
                    const image = node('img', 'signature-image');
                    image.src = row.signature;
                    image.alt = 'توقيع الطالب';
                    image.loading = 'lazy';
                    card.append(image);
                }

                if (isActive(row)) {
                    const reading = row.purpose === 'reading';

                    card.append(node(
                        'p',
                        'muted',
                        reading ? 'الحالة: قيد القراءة' : 'الحالة: مستعار'
                    ));

                    const finish = node(
                        'button',
                        'primary-button',
                        reading
                            ? 'إنهاء القراءة وإرجاع النسخة'
                            : 'تأكيد إرجاع الكتاب'
                    );

                    finish.type = 'button';

                    finish.addEventListener('click', () => {
                        if (!confirm('هل استلمتِ نسخة الكتاب فعليًا؟')) return;

                        runAction(finish, 'library_return_book', {
                            p_visit_id: row.id
                        });
                    });

                    card.append(finish);
                } else if (row.completed_at) {
                    card.append(node(
                        'p',
                        'muted',
                        'أُعيدت النسخة: ' + formatDate(row.completed_at)
                    ));
                }

                const remove = node('button', 'danger-button', 'حذف السجل');
                remove.type = 'button';
                remove.disabled = isActive(row);

                remove.title = isActive(row)
                    ? 'أكدي إرجاع الكتاب أولًا'
                    : 'حذف السجل نهائيًا';

                remove.addEventListener('click', () => {
                    if (!confirm('حذف هذا السجل نهائيًا؟')) return;

                    runAction(remove, 'library_delete_visits', {
                        p_visit_id: row.id
                    });
                });

                card.append(remove);
                container.append(card);
            });
        };

        $('search-input').addEventListener('input', renderRecords);

        $('clear-records').addEventListener('click', () => {
            if (!admin) return;

            if (!confirm(
                'حذف جميع السجلات نهائيًا؟ ' +
                'لن يُسمح بالحذف إذا توجد كتب لم تُرجع.'
            )) return;

            runAction($('clear-records'), 'library_delete_visits', {
                p_visit_id: null
            });
        });

        updateAdminView();
        refreshVisitOptions();
        switchTab(location.hash !== '#librarian');
    }

    // الشعار
    document.querySelectorAll('.college-logo').forEach(logo => {
        function fallback() {
            logo.hidden = true;

            const replacement = logo.parentElement.querySelector(
                '.logo-fallback'
            );

            if (replacement) {
                replacement.hidden = false;
                replacement.textContent = 'مكتبة الغد';
            }
        }

        logo.addEventListener('error', fallback);

        if (logo.complete && !logo.naturalWidth) fallback();
    });

    if ($('books-grid')) initializeGallery();
    if ($('student-form')) initializeVisits();

    // لا ننفذ استدعاءات قاعدة البيانات داخل callback المصادقة مباشرة.
    db.auth.onAuthStateChange(() => {
        setTimeout(() => {
            if ($('student-form')) checkAdmin();
        }, 0);
    });

    async function refresh() {
        if (document.hidden) return;

        await loadBooks();

        if (
            admin &&
            $('view-librarian') &&
            !$('view-librarian').hidden
        ) {
            await loadRecords();
        }
    }

    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refresh();
    });

    setInterval(refresh, 5000);
    refresh();
})();
