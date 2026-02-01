"use strict"

class AnimationManager {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.cancelled = new Set();
        this.nextId = 0;
    }

    enqueue(type, data) {
        // console.trace();
        // console.log("enqueued", type, data);
        const id = this.nextId++;
        this.queue.push({ type, data, id });
        if (!this.isProcessing) this.process();
        return id;
    }

    // Fire animation immediately without queuing (for parallel animations)
    // Returns a promise, not an ID (can't be cancelled)
    fire(type, data) {
        const handler = AnimationManager.handlers[type];
        if (handler) handler(data);
    }

    // Add a delay to the queue
    delay(ms) {
        this.enqueue('_delay', ms);
    }

    cancel(id) {
        this.cancelled.add(id);
    }

    async process() {
        this.isProcessing = true;
        while (this.queue.length > 0) {
            const { type, data, id } = this.queue.shift();
            if (this.cancelled.has(id)) {
                this.cancelled.delete(id);
                continue;
            }
            await this.execute(type, data);
            this.lastType = type;
            this.lastTime = Date.now();
        }
        this.isProcessing = false;
        this.lastType = null;
    }

    async execute(type, data) {
        const handler = AnimationManager.handlers[type];
        if (handler) await handler(data, this.lastType);
    }

    // Wait for all queued animations to complete
    async flush() {
        while (this.isProcessing) {
            await new Promise(r => setTimeout(r, 16));
        }
    }

    clear() {
        this.queue = [];
        this.cancelled.clear();
    }

    static handlers = {};

    static register(type, handler) {
        AnimationManager.handlers[type] = handler;
    }
}

const anim = new AnimationManager();
const drawAnim = [new AnimationManager(), new AnimationManager()];

// --- Animation Handlers ---

AnimationManager.register('_delay', (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
});

AnimationManager.register('statUpdate', ({ ctx, atkOrHp, stat, baseline, card, unsaccable, delay }) => {
    setTimeout(() => {
        clearStat(ctx, 2, atkOrHp, card, unsaccable);
        drawStat(ctx, 2, atkOrHp, stat, baseline);
    }, delay);
    return Promise.resolve();
});

AnimationManager.register('cardDeath', ({ card, pl, pos }) => {
    const deadDiv = document.createElement("div");
    deadDiv.className = "dead";
    boardOverlays[pl][pos].appendChild(deadDiv);

    const par = cardSpaces[pl][pos].parentNode;
    setTimeout(() => par.classList.add("helpme"), 200);

    setTimeout(() => {
        deadDiv.remove();
        par.classList.remove("helpme");
        anim.fire("removeCard", { card });
    }, 600);

    return Promise.resolve();
});

AnimationManager.register('damage', ({ pl, pos, delay = 0 }) => {
    setTimeout(() => {
        const overlay = document.createElement("canvas");
        overlay.style.transitionDuration = "150ms";
        overlay.width = i_cards.dims[0] * 2;
        overlay.height = i_cards.dims[1] * 2;
        i_cards.draw(overlay.getContext("2d"), 2, 1, 3, 0, 0);
        boardOverlays[pl][pos].appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = 0.75;
            setTimeout(() => {
                overlay.style.opacity = 0;
                setTimeout(() => overlay.remove(), 150);
            }, 200);
        });

    }, delay);

    return Promise.resolve();
});

AnimationManager.register('attack', ({ card, pos, pl, target }) => {
    moveForward(card, pos, pl, target);

    const s = cardSpaces[pl][target];
    if (!game.canBlock) {
        s.style.opacity = 0;
        setTimeout(() => { s.style.opacity = ""; }, 650);
    }

    setTimeout(() => {
        card.style.transform = "";
    }, 500);

    return Promise.resolve();
});

AnimationManager.register('materialize', ({ card, pl, pos }) => {
    const targetEl = cardSpaces[pl][pos];
    targetEl.innerHTML = "";
    targetEl.appendChild(card);
    card.style.scale = "0";
    card.style.opacity = "0";
    card.classList.add("suppressEvents");
    card.style.transition = "scale 250ms ease-out, opacity 250ms ease-out";

    requestAnimationFrame(() => {
        card.style.opacity = 1;
        card.style.scale = 1;
        setTimeout(() => {
            card.style.opacity = "";
            card.style.scale = "";
            card.style.transition = "";
            card.classList.remove("suppressEvents");
        }, 250);
    });

    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, 150);
    });
});

AnimationManager.register('removeCard', ({ card }) => {
    card.canvas.remove();
    if (card.sigilEls.indexOf(hoveredTT) != -1) {
        hoveredTT = null;
        tooltip.style.opacity = 0;
        tooltip.style.visibility = "hidden";
    }

    return Promise.resolve();
});

AnimationManager.register('deckDraw', ({ pl, deckDiv }) => {
    let el = deckPiles[pl][deckDiv];
    if (deckDiv == 1) el = el.lastElementChild;
    let copy = copyCanvas(el);
    deckSpaces[pl][deckDiv].appendChild(copy);
    copy.className = "drawing";

    requestAnimationFrame(() => {
        copy.style.transform = "translateY(" + (pl == 0 ? 1 : -1) * 500 + "px)";
        setTimeout(() => {
            copy.remove();
        }, 600);
    });

    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, 300);
    });
});

AnimationManager.register('drawDeckShadow', ({ uiSide, manaOrCard, cards }) => {
    if (deckPiles[uiSide][manaOrCard] === null) return Promise.resolve();

    if (cards === 0) {
        deckPiles[uiSide][manaOrCard].parentNode.style.visibility = "hidden";
        return Promise.resolve();
    }

    deckPiles[uiSide][manaOrCard].parentNode.style.visibility = "";
    const c = deckShadows[uiSide][manaOrCard];
    drawShadow(c, cards);
    return Promise.resolve();
});

AnimationManager.register('discardHand', ({ pl, cards, rects }) => {
    let transes = [];
    for (let i = 0; i < cards.length; i++) {
        cards[i].classList.add("suppressEvents");
        const targetRect = {
            top: rects[i].top + 500 * (pl == 0 ? 1 : -1),
            left: rects[i].left
        };
        const trans = createTransporter(cards[i], null, rects[i], targetRect, playScr);
        trans.style.transitionTimingFunction = "ease-in";
        trans.style.transitionDuration = "500ms";
        transes.push(trans);
    }

    setTimeout(() => {
        for (let t of transes) t.remove();
    }, 500);

    return Promise.resolve();
});

AnimationManager.register('playCard', ({ card, pl, target, nc }) => {
    const div = document.createElement("div");
    div.className = "ghostCard";
    const myRect = card.getBoundingClientRect();

    if (card.classList.contains("ghostCard")) {
        card = card.nextSibling;
    }

    try { hands[pl].replaceChild(div, card); } catch (_) {
        div.remove();
        card.classList.add("wackyStuff");
    }

    void div.offsetHeight;
    const margin = calcMargin(hands[pl], hands[pl].children.length - 2);
    div.style.width = "0px";
    div.style.marginRight = (div === hands[pl].lastElementChild ? defaultMargin - margin : 0) + "px";

    setTimeout(() => div.remove(), 300);

    const trans = document.createElement("div");
    trans.className = "transporter";
    playScr.appendChild(trans);
    trans.appendChild(card);
    card.classList.add("suppressEvents");
    card.classList.remove("selected");
    clearInterval(animationIntv);
    void card.offsetHeight;
    card.style.transform = "";
    trans.style.top = myRect.top + "px";
    trans.style.left = myRect.left + "px";
    void trans.offsetHeight;

    if (pl === 1 && nc) {
        trans.style.transform = "rotateY(180deg)";
        setTimeout(() => {
            trans.replaceChild(nc, card);
            nc.classList.add("suppressEvents");
        }, 100);
    }

    const targetEl = cardSpaces[pl][target];
    const targetOverlay = boardOverlays[pl][target];
    const targetRect = targetEl.getBoundingClientRect();
    trans.style.top = targetRect.top + "px";
    trans.style.left = targetRect.left + "px";

    // anim.delay(150);

    setTimeout(() => {
        const c2 = nc ?? card;
        trans.remove();
        c2.classList.remove("wackyStuff");
        targetOverlay.innerHTML = "";
        targetEl.parentNode.classList.remove("helpme");
        setTimeout(() => c2.classList.remove("suppressEvents"), 200);

        if (game.overBool) return;
        targetEl.appendChild(c2);
    }, 200);

    return new Promise(resolve => setTimeout(resolve, 150));
});

AnimationManager.register('addToHand', ({ card, pl, justPlayed }, lastType) => {
    const delay = lastType === 'addToHand' ? Math.max(300 - (Date.now() - drawAnim[pl].lastTime), 0) : 0;

    return new Promise(resolve => {
        setTimeout(() => {

            const cards = hands[pl].children.length;
            const margin = calcMargin(hands[pl], cards);
            const desiredWidth = (cards + (justPlayed ? 0 : 1)) * (2 * cardWidth + margin) - margin;
            const desiredPos = (innerWidth + desiredWidth) / 2 - 2 * cardWidth;

            hands[pl].style.width = hands[pl].offsetWidth + "px";
            void hands[pl].offsetWidth;
            hands[pl].style.width = desiredWidth + "px";

            card.style.left = desiredPos + "px";
            card.classList.add("adding", "suppressEvents");
            card.style.top = (pl === 0 ? 1 : -1) * 500 + "px";

            hands[pl].parentNode.appendChild(card);
            void card.offsetHeight;
            card.style.top = "0";

            setTimeout(() => {
                card.classList.remove("adding");
                setTimeout(() => card.classList.remove("suppressEvents"), 200);
                card.style.left = "";
                card.style.top = "";

                if (!card.classList.contains("wackyStuff")) {
                    if (game.overBool) {
                        card.remove();
                        return;
                    }

                    const el = hands[pl].lastElementChild;
                    if (el) el.style.transition = "none";
                    hands[pl].appendChild(card);
                    setTimeout(() => { if (el) el.style.transition = ""; }, 100);
                }

                hands[pl].style.width = "";

                if (drawProm) {
                    drawProm();
                    drawProm = null;
                }
            }, 450);

            setTimeout(() => {
                resolve();
            }, 300);
        }, delay);
    });
});

AnimationManager.register('sacOverlay', ({ overlay, card, pos }) => {
    overlay.style.transitionDuration = "100ms";
    overlay.width = i_cards.dims[0] * 2;
    overlay.height = i_cards.dims[1] * 2;
    i_cards.draw(overlay.getContext("2d"), 2, 0, 2, 0, 0);
    boardOverlays[0][pos].appendChild(overlay);
    void overlay.offsetHeight;
    overlay.style.opacity = 0.75;
    return Promise.resolve();
});

AnimationManager.register('removeSacOverlay', ({ overlay }) => {
    overlay.style.opacity = 0;
    return new Promise(resolve => {
        setTimeout(() => {
            overlay.remove();
            resolve();
        }, 120);
    });
});

const moveDelays = [0, 150, 300, 400];
AnimationManager.register('move', ({ card, fromPos, pl, toPos }) => {
    if (toPos === fromPos) return Promise.resolve();

    const dips = [0, 0, 50, 75];
    const ind = Math.min(moveDelays.length - 1, Math.abs(toPos - fromPos));
    const duration = moveDelays[ind];
    const plSign = pl === 0 ? 1 : -1;
    const dip = -dips[ind] * plSign;
    const difX = 120 * (toPos - fromPos) * (game.myTurn === 1 ? -1 : 1);
    const frameDur = 50;

    card.style.transition = "translate " + frameDur + "ms linear";
    card.classList.add("suppressEvents");

    return new Promise(resolve => {
        let angle = Math.PI;
        const incr = Math.PI * frameDur / duration;

        const animate = () => {
            angle += incr;
            if (angle + 0.00001 > 2 * Math.PI) {
                card.style.translate = "";
                card.style.transition = "";
                cardSpaces[pl][toPos].appendChild(card);
                card.classList.remove("suppressEvents");
                resolve();
                return;
            }
            card.style.translate = `${Math.cos(angle) * (difX / 2) + difX / 2}px ${Math.sin(angle) * dip}px`;
            setTimeout(animate, frameDur);
        };
        animate();
    });
});

AnimationManager.register('updateBones', ({ side, value }) => {
    const display = value === Infinity ? "∞" : value;
    boneSpans[side].textContent = "x" + display;
    return Promise.resolve();
});

AnimationManager.register('updateBlockActions', ({ delta }) => {
    blockActions += delta;
    if (selectedCard != null) {
        if (blockActions === 0 || (!isSaccing && blockActions === 1)) {
            boards[0].classList.add("spacesClickable");
        } else {
            boards[0].classList.remove("spacesClickable");
        }
    }
    if (blockActions === 0) {
        hands[0].classList.add("cardsClickable");
        bell.classList.add("selectable");
        hammer.classList.add("selectable");
        gameItemDivs[0].parentNode.classList.add("selectable");
    } else {
        hands[0].classList.remove("cardsClickable");
        bell.classList.remove("selectable");
        hammer.classList.remove("selectable");
        gameItemDivs[0].parentNode.classList.remove("selectable");
    }
    return Promise.resolve();
});

let scaleIntv = null;
let toConsume = 0;
let scalePartial = 0;
AnimationManager.register('updateScale', ({ damage }) => {
    if (toConsume == 0) {
        function f() {
            if (toConsume == 0) {
                clearInterval(scaleIntv);
                return;
            }
            const dir = toConsume > 0 ? 1 : -1;
            scalePartial += dir;
            if (scalePartial <= 0 && scalePartial < -game.tips[0] || scalePartial >= 0 && scalePartial > game.tips[1]) {
                scaleVal.textContent = scalePartial;
            }
            else {
                setScale(scalePartial);
            }
            toConsume -= dir;
        }
        clearInterval(scaleIntv);
        scaleIntv = setInterval(f, 300);
        toConsume = damage;
        f();
    }
    else {
        toConsume += damage;
    }

    return Promise.resolve();
});

AnimationManager.register('flipDirection', ({ el, direction, myTurn }) => {
    el.style.transform = "rotateY(" + ((direction == 1) == (myTurn == 0) ? 0 : 180) + "deg)";
    return Promise.resolve();
});

AnimationManager.register('promptForDraw', ({ qty }) => {
    const rect = myDecks.getBoundingClientRect();
    drawOverlay.style.top = rect.top - nuhuhPadding + "px";
    drawOverlay.style.left = rect.left - nuhuhPadding + "px";
    nuhuh.style.transitionDuration = "300ms";
    nuhuh.style.opacity = "1";

    if (run) {
        const rect = gidParent.getBoundingClientRect();
        lensEl.style.top = rect.top + "px";
        lensEl.style.left = rect.left + "px";
        lensEl.classList.add("events");
    }

    const t = game.manas ? 2 : 1;
    for (let i = 0; i < t; i++) {
        async function myFunc() {
            if (qty == 0) return;
            qty--;
            if (qty == 0) {
                for (let j = 0; j < t; j++) {
                    deckPiles[0][j].removeEventListener("click", myFunc);
                    deckPiles[0][j].style.cursor = "";
                }
                nuhuh.style.transitionDuration = "100ms";
                nuhuh.style.opacity = "0";
                lensEl.classList.remove("events");
            }

            sendMsg(codeDecision + " " + i);
            await game.drawCard(i);

            if (qty == 0) {
                updateBlockActions(-1);
            }
        }
        deckPiles[0][i].addEventListener("click", myFunc);
        deckPiles[0][i].style.cursor = "pointer";
    }
});