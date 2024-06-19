"use strict"

let itemTypes=[];
class Item{
    constructor(name,desc,file,lots,theirFunc,myFunc=null){
        this.name=name;
        this.desc=desc;
        this.lots=lots;
        this.theirFunc=theirFunc;
        this.id=itemTypes.length;
        itemTypes.push(this);

        if(myFunc==null){
            myFunc=async function(i){
                sendMsg(codeItem+" "+this.id);
                await theirFunc(i);
            }.bind(this);
        }
        this.myFunc=myFunc;

        if(!(file in imgMap)){
            imgMap[file]=new ImgWrapper("items/"+file);
        }
        this.file=imgMap[file];
    }
}

const rockItem=new Item("Boulder in a Bottle","Obtenha uma Pedra 0/3.","boulder.webp",()=>1,async function(i){
    await consumeItem(i);
    await game.addCardToHand(c_rock,game.turn);
});

const pliersItem=new Item("Pliers","Causa 1 de dano ao oponente.","pliers.webp",()=>1,async function(i){
    await consumeItem(i);
    await game.tiltScales(1,null,null);
    game.checkScales();
});

const bonesItem=new Item("Hoggy Bank","Ganhe 2 ossos.","bones.webp",()=>0.25,async function(i){
    await consumeItem(i);
    game.bones[game.turn]+=2;
    updateBones(game.turn);
});

function maintainOppItems(search=run.revealedItems){
    let ind;

    if(run.revealedItems.length>2){
        ind=run.oppUnusedItems.indexOf(null);
        if(ind==-1){
            if(run.usedQueue.length==0){
                oldest=lensItem.id;
            }
            else{
                oldest=run.usedQueue[0];
                run.usedQueue.splice(0,1);
            }
            ind=search.indexOf(oldest);
        }
        run.revealedItems.splice(ind,1);
        run.oppUnusedItems.splice(ind,1);
    }
    else{
        ind=run.revealedItems.length;
    }
    return ind;
}

const lensItem=new Item("Magpie's Lens","Espie secretamente a mão e os itens do oponente.","lens.webp",()=>1,
null,
async function(i){
    sendMsg(codeShowMe);
    let consumeProm=consumeItem(i);
    let msgProm=getNextMsg();
    msgProm.then((msg)=>{
        const firstAndRest=msg.substring(2).split("\n");
        let lines=firstAndRest.slice(1);
        const oppCards=hands[1].children;

        for(let i=0; i<lines.length; i++){
            if(oppCards[i].classList.contains("revealed")){
                continue;
            }

            const spl1=lines[i].split("/",2);
            const spl2=spl1[0].split(" ");
            let atk=parseInt(spl2[0]),hp=parseInt(spl2[1]),id=parseInt(spl2[2]),unsac=spl2[3]=="1";
            let card;
            if(id==-1){
                let cost=parseInt(spl2[4]);
                let element=parseInt(spl2[5]);
                let customSigs=[];
                for(let i=6; i<spl2.length; i++){
                    customSigs.push(parseInt(spl2[i]));
                }
                card=new Card();
                card.init("Dr Fire Esq.",cost,atk,hp,element,customSigs,null,[5,16],false,true);
            }
            else{
                card=allCards[id];
            }

            const cardDiv=card.renderAlsoReturnCtx(2,unsac,atk,hp).div;
            if(spl1.length>1){
                let extraSigs=[];
                const spl3=spl1[1].split(" ");
                for(let j=0; j<spl3.length; j++){
                    extraSigs.push(allSigils[parseInt(spl3[j])]);
                }
                addDrip(extraSigs,cardDiv,2);
            }

            const ref=oppCards[i];
            const cardDivDiv=document.createElement("div");
            cardDivDiv.className="revealed anim";
            cardDivDiv.appendChild(cardDiv);
            hands[1].replaceChild(cardDivDiv,ref);
            cardDivDiv.prepend(ref);
            setTimeout(function(){
                cardDivDiv.classList.remove("anim");
            },500);
        }

        const ric=[...run.oppUnusedItems];
        if(firstAndRest[0]!=""){
            const itemCodes=firstAndRest[0].split(" ");
            for(let i=0; i<itemCodes.length; i++){
                const code=parseInt(itemCodes[i]);
                const ind=ric.indexOf(code);
                if(ind==-1){
                    let ind=maintainOppItems(ric);
                    run.revealedItems.push(code);
                    run.oppUnusedItems.push(code);

                    ric[ind]=null;
                    const el=sigilElement(itemTypes[code],"img");
                    el.src=itemTypes[code].file.src;
                    theirItems[ind].innerHTML="";
                    theirItems[ind].appendChild(el);
                }
                else{
                    ric[ind]=null;
                }
            }
        }
    });
    await Promise.all([msgProm,consumeProm]);
});

function removeListeners(card){
    for(let ref of listenerRefs){
        for(let i=0; i<2; i++){
            let l2=[];
            for(let l of game[ref][i]){
                if(l.caller!=card){
                    l2.push(l);
                }
            }
            game[ref][i]=l2;
        }
    }
}

const hookItem=new Item("Fisherman's Hook","Mude uma carta sua de posição.","hook.webp",()=>1,
async function(i,args){
    const target=args[0];
    const targetData=game.board[game.turn][target];
    const uiTurn=+(game.turn!=game.myTurn);
    const cardDiv=unplayCard(uiTurn,target);
    targetData.pos=null;
    game.board[game.turn][target]=null;
    for(let s of targetData.sigils){
        for(let q of s.funcs.onCardMoved){
            if(q.type==listen_me) await q.func(targetData,target,targetData,s.data);
        }
    }
    for(let l of [...game.movementListeners[game.turn]]){
        await l.func(l.caller,target,targetData,l.data);
    }
    removeListeners(targetData);

    await Promise.all([consumeItem(i),game.addCardToHand(targetData.getCard(),targetData.side,function(c){
        c.health=targetData.health;
        c.updateStat(1,c.health);
    },null).then((card)=>{
        if(uiTurn==0){
            cardDiv.parentNode.replaceChild(card.canvas,cardDiv);
            selectCard(card);
            isSaccing=false;
            hooked=true;
            blockActions++;
            updateBlockActions();
        }
    })]);
},
async function(i){
    boards[0].classList.add("cardsClickable");
    const rect=boards[0].getBoundingClientRect();
    sniperOverlay.style.top=rect.top-nuhuhPadding+"px";
    sniperOverlay.style.left=rect.left-nuhuhPadding+"px";
    nuhuhSniper.style.transitionDuration="300ms";
    nuhuhSniper.style.opacity="0.5";

    while(true){
        let res=await Promise.any([game.over,new Promise((resolve)=>clickProm=resolve)]);
        if(!res){
            break;
        }
        boards[0].classList.remove("cardsClickable");
        let [pl,target]=res;
        if(pl==0 && game.board[game.myTurn][target]!=null){
            sendMsg(codeItem+" "+hookItem.id+" "+target);
            hookItem.theirFunc(i,[target]);
            break;
        }
    }

    nuhuhSniper.style.transitionDuration="100ms";
    nuhuhSniper.style.opacity="0";
});

const bleachItem=new Item("Magical Bleach","Remova as habilidades das cartas do oponente.","silence.webp",()=>1,
async function(i,args){
    const pl=1-game.turn;
    const b=game.board[pl];
    for(let i=0; i<b.length; i++){
        const targetData=b[i];
        if(targetData==null){
            continue;
        }

        const target=targetData.pos;
        let s2=[];
        targetData.pos=null;
        for(let s of targetData.sigils){
            if(s.funcs instanceof StatSigil) s2.push(s);
            else for(let q of s.funcs.onCardMoved){
                if(q.type==listen_me) await q.func(targetData,target,targetData,s.data);
            }
        }
        targetData.sigils=s2;

        for(let l of [...game.movementListeners[pl]]){
            await l.func(l.caller,target,targetData,l.data);
        }
        targetData.pos=target;
        removeListeners(targetData);

        const purged=targetData.sigilEls.filter((x)=>!x.classList.contains("bleach_survivor"));
        for(let s of purged){
            s.style.animation="fadeIn 500ms linear reverse";
            s.style.opacity="0";
        }
        setTimeout(function(){
            for(let s of purged){
                s.remove();
            }
        },500);
    }
    
    await consumeItem(i);
});

function closeItemModal(){
    itemModal.style.opacity="0";
    itemModal.style.visibility="hidden";
    itemModal.style.transitionDelay="0ms";
    hoveredTT=null;
    tooltip.style.visibility="hidden";
    tooltip.style.opacity=0;
}

function addItem(it){
    const c=sigilElement(it,"img");
    c.src=it.file.src;
    c.style.position="relative";
    itemDivs[run.items.length].appendChild(c);
    run.items.push(it);
}

async function consumeItem(i){
    let el;
    if(game.turn==game.myTurn){
        el=gameItemDivs[i].firstChild;
        run.usedItems.push(i);
    }
    else{
        el=theirItems[i].firstChild;
    }
    el.classList.add("shakeAndFade");
    void el.offsetHeight;
    el.style.filter="saturate(25%)";
    await new Promise((resolve)=>setTimeout(resolve,500));
}

function updateItemDivs(id=itemDivs,ini=0){
    for(let i=ini; i<id.length; i++){
        id[i].innerHTML="";
    }
    for(let i=ini; i<run.items.length; i++){
        const c=sigilElement(run.items[i],"img");
        c.src=run.items[i].file.src;
        c.style.position="relative";
        id[i].appendChild(c);
    }
}

const itemModal=document.querySelector("#itemModal");
const closeIM=itemModal.querySelector(".close");
closeIM.addEventListener("click",function(){ closeItemModal(); });
i_sigils.draw(closeIM.getContext("2d"),2,...[s_sidestep.coords],0,0);
const itemPres=document.querySelector("#itemPick");