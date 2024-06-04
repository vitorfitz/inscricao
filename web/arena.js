let run;
class Run{
    constructor(myTurn,tippingPoint=5,cardsPerTurn=1,lifeTotal=30,lanes=4){
        this.tippingPoint=tippingPoint;
        this.cardsPerTurn=cardsPerTurn;
        this.lifeTotal=lifeTotal;
        this.lanes=lanes;
        this.myTurn=myTurn;
    }

    async freshStart(){
        this.life=[this.lifeTotal,this.lifeTotal];
        this.deck=[];
        this.items=[[],[]];
        arenaDeck.innerHTML="";
        this.oppDeckSize=10;

        mapWrapper.innerHTML="";
        const mCanvas=await renderMap();
        mapWrapper.appendChild(mCanvas);
    }
}

const tapeImg=new Image();
tapeImg.src="icons/tape.png";
class ModdedCard{
    constructor(c){
        this.card=c;
        this.atkBoost=0;
        this.hpBoost=0;
        this.extraSigs=[];
        // this.extraAct=null;
    }

    getHealth(){return this.hpBoost+this.card.health;}
    getAttack(){return this.atkBoost+this.card.attack;}
    getCost(){return this.card.cost;}
    getElement(){return this.card.element;}
    getVisibleSigils(){return [...this.extraSigs,...this.card.visibleSigils];}

    addDrip(canvas,scale=2){
        if(this.extraSigs.length==0) return[];

        let els=[];
        const tagHolder=document.createElement("div");
        tagHolder.className="tagBearer";
        canvas.appendChild(tagHolder);

        for(let i=0; i<this.extraSigs.length; i++){
            const bgDiv=document.createElement("div");
            bgDiv.style.height=10*scale+"px";
            bgDiv.style.width=15*scale+"px";
            bgDiv.style.paddingLeft=2*scale+"px";
            if(i!=this.extraSigs.length-1) bgDiv.style.marginBottom=scale/8*i_sigils.dims[1]+"px";
            tagHolder.appendChild(bgDiv);

            const tapeClone=tapeImg.cloneNode();
            bgDiv.appendChild(tapeClone);

            const el=sigilElement(this.extraSigs[i]);
            els.push(el);
            bgDiv.appendChild(el);
            el.width=scale/2*i_sigils.dims[0];
            el.height=scale/2*i_sigils.dims[1];

            i_sigils.draw(el.getContext("2d"),scale/2,...this.extraSigs[i].coords,0,0);
        }
        return els;
    }

    render(scale){
        let c=this.card.render(scale,undefined,this.card.attack+this.atkBoost,this.card.health+this.hpBoost);
        this.addDrip(c,scale);
        return c;
    }
}

const cardSelect=document.querySelector("#card_choice");
function newRun(otherJSON,configs){
    run=new Run(otherJSON.myTurn,configs.tippingPoint,configs.cardsPerTurn,configs.lifeTotal);
    run.freshStart();
    updateHPs();
    updateDeck(1);
    cardPick(7,2,buffedCards);
}

const pick3=document.querySelector("#pick3");
const ccShadow=document.querySelector("#ccShadow");
const ccOverlay=drawNuhuh(pick3.offsetWidth+2*100,pick3.offsetHeight+2*100,100,80);
ccShadow.appendChild(ccOverlay);

const pickSpaces=pick3.querySelectorAll(".cardSpace");
let presentedCards=[];
for(let i=0; i<pickSpaces.length; i++){
    pickSpaces[i].addEventListener("click",function(){
        if(trialMode){
            playTrial(i);
        }
        else if(presentedCards[i]){
            const card=presentedCards[i];
            run.deck.push(card);
            // cardPickEls[cardPickPos].appendChild(presentedCards[i].render(2));
            let pos=cardPickPos;
            cardPickPos++;

            const origRect=pickSpaces[i].getBoundingClientRect();
            const targetRect=cardPickEls[pos].getBoundingClientRect();
            let origX=origRect.left+origRect.width/2;
            let origY=origRect.top+origRect.height/2;
            let targetX=targetRect.left+targetRect.width/2;
            let targetY=targetRect.top+targetRect.height/2;
            const trans=document.createElement("div");
            trans.className="transporter";
            trans.style.left=origX+"px";
            trans.style.top=origY+"px";
            trans.appendChild(pickSpaces[i].firstElementChild);
            cardSelect.appendChild(trans);
            void trans.offsetWidth;
            trans.style.left=targetX+"px";
            trans.style.top=targetY+"px";
            trans.style.transform="scale(0.5)";
            hoveredTT=null;
            tooltip.style.opacity=0;
            tooltip.style.visibility="hidden";

            setTimeout(function(){
                cardPickEls[pos].appendChild(card.render(2));
                trans.remove();
                if(pos!=cardPickEls.length-1){
                    presentCards();
                }
            },250);

            if(cardPickPos==cardPickEls.length){
                stopPicking();
            }
        }
    });
}

function randomCards(){
    const copy=[...cards];
    shuffle(copy,pickSpaces.length);
    return copy.slice(cards.length-pickSpaces.length);
}

function presentCards(){
    if(trialMode){
        showTrials();
    }
    else{
        presentedCards=generate();
        for(let i=0; i<presentedCards.length; i++){
            const c=presentedCards[i].render(4);
            pickSpaces[i].innerHTML="";
            pickSpaces[i].appendChild(c);
        }
    }
}

function stopPicking(){
    presentedCards=[];
    fader.classList.add("fade");
    setTimeout(function(){
        fader.classList.remove("fade");
        cardSelect.style.visibility="hidden";
        map.style.visibility="visible";
    },1000);
    hoveredTT=null;
    tooltip.style.opacity=0;
    tooltip.style.visibility="hidden";
    for(let i=0; i<pickSpaces.length; i++){
        pickSpaces[i].innerHTML="";
    }
    updateDeck(0);
}

const arenaDeck=document.querySelector("#arena_deck");
let cardPickPos=0;
let cardPickEls=[];
let generate;
let rerolls;
let trialMode=false;
const rerollEl=document.querySelector("#reroll");
const rerollSpan=rerollEl.querySelector("span");

function updateReroll(){
    if(rerolls==0){
        rerollEl.style.display="none";
    }
    else{
        rerollEl.style.display="";
        rerollSpan.textContent="x"+rerolls;
    }
}

rerollEl.addEventListener("click",function(){
    presentCards();
    rerolls--;
    updateReroll();
});

function cardPick(n,rr=0,gen=randomCards){
    map.style.visibility="hidden";
    cardSelect.style.visibility="visible";
    cardPickPos=0;
    cardPickEls=[];
    generate=gen;
    rerolls=rr;
    updateReroll();

    for(let i=0; i<n; i++){
        cardPickEls.push(document.createElement("div"));
        arenaDeck.appendChild(cardPickEls[i]);
    }
    presentCards();
}

const map=document.querySelector("#map");
const mapWrapper=map.querySelector("#mcWrapper");

function genMapModel(len=2, width=3, conns=3){
    let mm=[];
    let vis=new Array(width).fill(true);
    let visCount=3;

    for(let i=0; i<len; i++){
        let possible=[];
        mm[i]=[];

        for(let j=0; j<width; j++){
            if(vis[j]){
                const end=Math.min(width-1,j+1);
                for(let k=Math.max(0,j-1); k<=end; k++){
                    possible.push([j,k]);
                }
            }
            mm[i][j]=[];
        }

        shuffle(possible);
        let banned=new Array(width-1).fill(-2);
        let picked=[];
        let skipped=[];
        let exited=new Array(width).fill(0);
        let repeatThresh=visCount;
        let qtd=0;

        for(let j=0; j<possible.length && qtd<conns; j++){
            const v=possible[j];
            if(exited[v[0]]){
                if(repeatThresh>=width){
                    continue;
                }
                else{
                    repeatThresh++;
                }
            }

            if(v[0]!=v[1]){
                const banIndex=Math.min(v[0],v[1]);
                if(banned[banIndex]==-1){
                    continue;
                }
                else if(banned[banIndex]>=0){
                    skipped.push(banned[banIndex]);
                    exited[possible[banned[banIndex]][0]]--;
                    picked.push(j);
                    exited[v[0]]++;
                }
                else{
                    picked.push(j);
                    qtd++;
                    exited[v[0]]++;
                    banned[banIndex]=-1;
                    // if(v[0]==0 || v[0]==width-1){
                    //     banned[banIndex]=-1;
                    // }
                    // else{
                    //     banned[banIndex]=j;
                    // }
                }
            }
            else{
                picked.push(j);
                qtd++;
                exited[v[0]]++;
            }
        }

        const oldVis=[...vis];
        visCount=0;
        vis.fill(false);
        let removeOne=-1;

        for(let j=0; j<width; j++){
            if(exited[j]==0 && oldVis[j]){
                mm[i][j].push(j);
                vis[j]=true;
                visCount++;

                console.log(qtd,conns);
                if(qtd>=conns){
                    for(let k=0; k<width; k++){
                        if(exited[k]>=2){
                            removeOne=k;
                            exited[k]--;
                            qtd--;
                        }
                    }
                }
            }
        }

        if(qtd+visCount==2 && width==3 && oldVis[1]){
            mm[i][1].push(1);
            if(!vis[1]){
                vis[1]=true;
                visCount++;
            }
        }

        for(let j=0,s=0; j<picked.length; j++){
            if(s<skipped.length && skipped[s]==j){
                s++;
            }
            else{
                const v=possible[picked[j]];
                if(v[0]==removeOne){
                    removeOne=-1;
                    continue;
                }

                mm[i][v[0]].push(v[1]);
                if(!vis[v[1]]){
                    vis[v[1]]=true;
                    visCount++;
                }
            }
        }
    }

    return mm;
}

function has(pe,sigil){
    return pe.sigils.indexOf(sigil)!=-1;
}

let sigilEstimates={};
{
    const se=sigilEstimates;
    se[s_bomb.id]={mod:(pe)=>{
        pe.additiveExt+=5.5;
        if(has(pe,s_flying)) pe.offense*=0.66;
        else pe.offense*=0.33;
        pe.defense*=0.33;
    }};
    se[s_digger.id]={mod:(pe)=>{
        pe.additive+=0.45;
        pe.presence+=0.3;
    }};
    se[s_brittle.id]={uselessAt0: true,mod:(pe)=>{
        if(pe.attack>0) pe.defense=0;
    }};
    se[s_bifurcated.id]={uselessAt0: true,mod:(pe)=>{
        if(has(pe,s_flying)) pe.offense*=1.9;
        else pe.offense*=1.8;
    }};
    se[s_extra_attack.id]={uselessAt0: true,mod:(pe)=>{
        if(has(pe,s_flying)) pe.offense*=2.06;
        else pe.offense*=2.2;
    }};
    se[s_death_touch.id]={uselessAt0: true,mod:(pe)=>{
        if(pe.attack==0) return;
        if(has(pe,s_bifurcated)) pe.offense*=1+1.5/(pe.attack*(pe.attack+1)/2);
        else if(has(pe,s_extra_attack)) pe.offense*=1.1;
        else if(has(pe,s_flying)) pe.offense*=1+0.1/(pe.attack*(pe.attack+1)/2);
        else pe.offense*=1+2/(pe.attack*(pe.attack+1)/2);
    }};
    se[s_double_death.id]={mod:(pe)=>{
        pe.additive+=0.7;
        pe.presence+=0.7;
    }};
    se[s_fecundity.id]={ext:(pe)=>{
        pe.additiveExt+=3+pe.res/4;
    }};
    se[s_undying.id]={ext:(pe)=>{
        if(has(pe,s_worthy)) pe.additiveExt+=3+pe.res/4;
        else if(!has(pe,s_fecundity)) pe.additiveExt+=(3+pe.res/4)*(0.8**((has(pe,s_aquatic)? 2: 1)*pe.defense+0.5));
        else pe.additiveExt+=0.5;
    }};
    se[s_sq_spawner.id]={mod:(pe)=>{
        pe.additive+=0.8;
        pe.presence+=0.4;
    }};
    se[s_skele_spawner.id]={mod:(pe)=>{
        pe.additive+=0.8;
        pe.presence+=0.6;
    }};
    se[s_rabbit.id]={ext:(pe)=>{
        pe.additiveExt+=2;
    }};
    se[s_explosive.id]={ext:(pe)=>{
        pe.additiveExt+=Math.max(0,5-pe.res/2);
    }};
    se[s_flying.id]={uselessAt0: true,boost:(pe)=>{
        if(pe.offense!=0) pe.additive+=((0.5+pe.defense)*(0.5+pe.offense))*0.18;
    }};
    se[s_energy.id]={ext:(pe)=>{
       pe.res+=2.5/2**(pe.res/7.5);
    }};
    se[s_push.id]={};
    se[s_bones.id]={boost:(pe)=>{
        pe.additive+=3-3*(1-0.7**pe.defense);
    }};
    se[s_reach.id]={boost:(pe)=>{
        if(!has(pe,s_aquatic)){
            if(has(pe,s_burrow)) pe.additive+=(pe.defense+1/3)/5;
            else pe.additive+=(pe.defense+1)/16;
        }
    }};
    se[s_sidestep.id]={boost:(pe)=>{
        if(!has(pe,s_burrow) && !has(pe,s_guardian) && !has(pe,s_sq_spawner) && !has(pe,s_skele_spawner) && !has(pe,s_push)) pe.additive+=pe.defense/8;
    }};
    se[s_guardian.id]={};
    se[s_free_sac.id]={mod:(pe)=>{
        if(has(pe,s_worthy)){
            pe.additiveExt+=9.2;
            pe.presence+=3;
        }
        else{
            pe.additiveExt+=3.5;
            pe.presence+=1.2;
        }
    }};
    se[s_quills.id]={boost:(pe)=>{
        if(!has(pe,s_aquatic)){
            if(has(pe,s_death_touch)){
                if(has(pe,s_burrow)){
                    pe.additive+=(pe.defense+1.5)*2;
                }
                else{
                    pe.additive+=(pe.defense+3);
                }
            }
            else{
                if(has(pe,s_burrow)){
                    pe.additive+=(pe.defense+1/3)*1.5;
                }
                else{
                    pe.additive+=(pe.defense+1)/2;
                }
            }
        }
    }};
    se[s_aquatic.id]={aquatic:(pe)=>{
        if(!has(pe,s_brittle)){
            pe.defense=pe.offense+pe.presence+0.1*(pe.hp-1);
            pe.additive+=pe.presence*4;
        }
    }};
    se[s_worthy.id]={ext:(pe)=>{
        if(!has(pe,s_free_sac)) pe.res+=7.5/2**(pe.res/7.5);
    }};
    se[s_tutor.id]={boost:(pe)=>{
        pe.additiveExt+=6.5;
    }};
    se[s_burrow.id]={mod:(pe)=>{
        pe.defense*=0.625;
    },boost:(pe)=>{
        pe.additive+=1*pe.defense**1.25;
    }};
    se[s_sniper.id]={uselessAt0: true,boost:(pe)=>{
        if(pe.offense!=0){
            if(!has(pe,s_flying)) pe.additive+=((1+pe.defense)*(1+pe.offense))*0.36;
            else pe.additive+=(pe.offense)*0.2;
        }
    }};
    se[s_dam.id]={boost:(pe)=>{
        if(has(pe,s_alpha)) pe.additiveExt+=5;
        else if(has(pe,s_sq_spawner) || has(pe,s_skele_spawner) || has(pe,s_explosive)) pe.additiveExt+=2;
        else pe.additiveExt+=3.5;
    }};
    se[s_alpha.id]={mod:(pe)=>{
        pe.additive+=0.6;
        if(has(pe,s_guardian) || has(pe,s_burrow)) pe.presence+=0.4;
        else pe.presence+=0.6;
    }};
    se[s_stinky.id]={mod:(pe)=>{
        pe.defense*=1.7;
        pe.additive+=1;
    }};
    se[s_beehive.id]={mod:(pe)=>{
        if(!has(pe,s_aquatic) && !has(pe,s_brittle)) pe.additive+=(pe.defense+0.5)*1.75;
    }};
}

const eligibleCards=[];
a: for(let i=0; i<cards.length; i++){
    if(cards[i].activated) continue;
    for(let j=0; j<cards[i].sigils.length; j++){
        if(!(cards[i].sigils[j].id in sigilEstimates)){
            continue a;
        }
    }
    eligibleCards.push(cards[i]);
}

const eligibleSigils=[];
for(let id in sigilEstimates){
    eligibleSigils.push(allSigils[id]);
}

class PowerEstimate{
    constructor(atk,hp,sigils=[]){
        this.attack=atk;
        this.hp=hp;
        this.offense=atk;
        this.presence=0;
        this.defense=hp;
        this.additive=0;
        this.additiveExt=0;
        this.multiplicative=1;
        this.sigils=sigils;
    }
    calc(){
        let s=[];
        for(let i=0; i<this.sigils.length; i++){
            const se=sigilEstimates[this.sigils[i].id];
            if(se){
                s.push(se);
            }
        }

        for(let i=0; i<s.length; i++){
            if(s[i].mod) s[i].mod(this);
        }
        for(let i=0; i<s.length; i++){
            if(s[i].aquatic) s[i].aquatic(this);
        }
        for(let i=0; i<s.length; i++){
            if(s[i].boost) s[i].boost(this);
        }

        if(this.offense==0 && !has(this,s_beehive)) this.offense=Math.max(0,8-this.defense)/(15+30*this.presence);
        let res=(this.offense*2.5)+this.defense*1;
        let excessHP=Math.abs(this.defense-this.offense);
        if(this.offense>this.defense) excessHP*=2.5;
        excessHP+=Math.abs(this.defense-this.offense);
        excessHP*=8;
        excessHP/=10+2*res;
        excessHP+=0.8;
        if(excessHP>0){
            res-=5*excessHP;
            res+=5*(0.95**excessHP-1)/(0.95-1);
        }

        if(this.offense>3) res+=(this.offense-3)**2/10;
        res+=this.additive;
        res+=this.defense*(this.presence);
        if(res<3) res+=(3-res)/2;
        this.res=res;

        for(let i=0; i<s.length; i++){
            if(s[i].ext) s[i].ext(this);
        }
        this.res+=this.additiveExt;
        this.res*=this.multiplicative;
        return this.res;
    }
}

const costToPower=[
    [3,4.5,6,7.5,9,10.5,12,13.5,15,17,19],
    [3,6.5,10,14.5,27],
    [3,3.5,4,5,6.5,8,9.5]
];
function elToPosition(el){
    switch(el){
        case bones: return 0;
        case blood: return 1;
        case energy: return 2;
    }
}

const forbiddenCombos={};
function addForbidden(s1,s2){
    forbiddenCombos[s1.id]=s2;
    forbiddenCombos[s2.id]=s1;
}
addForbidden(s_skele_spawner,s_sq_spawner);
addForbidden(s_bomb,s_dam);

function checkAllowed(sigs){
    for(let i=0; i<sigs.length; i++){
        const fc=forbiddenCombos[sigs[i].id];
        if(fc && sigs.indexOf(fc)!=-1) return false;
    }
    return true;
}

const numMono=2;
const numDual=2;
function buffedCards(){
    const copy=[...eligibleCards];
    shuffle(copy,pickSpaces.length);
    const picks=copy.slice(eligibleCards.length-pickSpaces.length);
    let results=[];

    for(let i=0; i<picks.length; i++){
        let sCopy=[];
        for(let j=0; j<eligibleSigils.length; j++){
            const s=eligibleSigils[j];
            if(s!=s_skele_spawner && !(picks[i].attack==0 && sigilEstimates[s.id].uselessAt0) && picks[i].sigils.indexOf(s)==-1){
                sCopy.push(s);
            }
        }

        // console.log(picks[i]);
        // picks[i]=c_477;
        let basePower=costToPower[elToPosition(picks[i].element)][picks[i].cost];
        let minThresh=(basePower)*1.24;
        let maxThresh=(basePower)*1.36;
        // console.log(minThresh,maxThresh);

        let combos=[];
        for(let j of sCopy){
            const together=[j,...picks[i].sigils];
            if(checkAllowed(together)){
                const ev=(new PowerEstimate(picks[i].attack,picks[i].health,together)).calc();
                if(ev>=minThresh && ev<=maxThresh){
                    for(let i=0; i<numMono; i++){
                        combos.push([j]);
                        if(j==s_burrow) for(let i=0; i<3; i++) combos.push([j]);
                        if(j==s_tutor) for(let i=0; i<9; i++) combos.push([j]);
                        if(j==s_flying) for(let i=0; i<3; i++) combos.push([j]);
                    }
                }
            }
        }
        for(let j=0; j<numDual*sCopy.length;){
            shuffle(sCopy,2);
            const combo=sCopy.slice(sCopy.length-2);
            const together=[...combo,...picks[i].sigils];
            if(checkAllowed(together)){
                const ev=(new PowerEstimate(picks[i].attack,picks[i].health,together)).calc();
                if(ev>=minThresh && ev<=maxThresh){
                    combos.push(combo); 
                    if(combo.indexOf(s_brittle)!=-1) for(let i=0; i<9; i++) combos.push(combo);
                    if(combo.indexOf(s_burrow)!=-1) for(let i=0; i<3; i++) combos.push(combo);
                    if(combo.indexOf(s_tutor)!=-1) for(let i=0; i<9; i++) combos.push(combo);
                    if(combo.indexOf(s_flying)!=-1) for(let i=0; i<3; i++) combos.push(combo);
                }
                j++;
            }
        }
        // console.log(combos);

        let choice=[];
        if(combos.length>0){
            choice=combos[Math.floor(Math.random()*combos.length)];
        }
        const modded=new ModdedCard(picks[i]);
        modded.extraSigs=choice;
        results.push(modded);
    }

    return results;
}

let nodeTypes=[];
let imgMap={};
class NodeType{
    constructor(name,desc,src,fn,lots=()=>1){
        this.name=name;
        this.desc=desc;
        this.fn=fn;
        this.lots=lots;
        this.id=nodeTypes.length;
        nodeTypes.push(this);

        if(!(src in imgMap)){
            imgMap[src]=new ImgWrapper("map/"+src);
        }
        this.src=imgMap[src];
    }
}

class ImgWrapper extends Image{
    constructor(src){
        super();
        this.src=src;
        this.loaded=new Promise((resolve)=>{
            this.onload=resolve;
        });
    }
}

const cardNode=new NodeType("Card Choice","Adicione 2 cartas ao seu deck.","pick_card.webp",async function(){
    fader.classList.add("fade");
    await new Promise((resolve)=>setTimeout(function(){
        fader.classList.remove("fade");
        cardPick(2,3);
        resolve();
    },1000));
},()=>999);
const battleNode=new NodeType("Batalha",null,"battle.webp",function(){

},()=>0);
const trialNode=new NodeType("Deck Trial","Escolha uma categoria, se seu deck passar nela você ganha uma carta OP.","trial.webp",async function(){
    fader.classList.add("fade");
    await new Promise((resolve)=>setTimeout(function(){
        fader.classList.remove("fade");
        trialMode=true;
        cardPick(0,3,buffedCards);
        resolve();
    },1000));
},()=>1);
const buildNode=new NodeType("Build-a-Card","Crie uma carta e adicione ao seu deck.","build.webp",function(){

},()=>0.5);
const fireNode=new NodeType("Campfire","Aumenta o ataque ou vida de uma carta.","Campfire.webp",function(){

},()=>2);
const itemNode=new NodeType("Item","Escolha um de 3 itens.","item.webp",function(){

},()=>4);

class MapNode{
    constructor(x,y){
        this.x=x;
        this.y=y;
        this.fwd=[];
        this.back=[];
        this.type=null;
        this.el=null;
    }
}

// function binarySearch(arr, val) {
//     let start = 0;
//     let end = arr.length - 1;

//     while (start <= end) {
//         let mid = Math.floor((start + end) / 2);
//         if (val < arr[mid]) {
//             end = mid - 1;
//         } else {
//             start = mid + 1;
//         }
//     }
//     return start;
// }

const mapPaddingX=50,mapPaddingY=50;
async function renderMap(xSpacing=150,ySpacing=115,len=2,conns=3){
    const width=3;
    const d=document.createElement("div");
    d.style.position="relative";
    const c=document.createElement("canvas");
    const ctx=c.getContext("2d");
    c.width=xSpacing*(width-1)+mapPaddingX;
    c.height=ySpacing*(len+2)+mapPaddingY;
    d.appendChild(c);

    const mm=[[[],[],[]],...genMapModel(len,width,conns),[]];

    for(let i=0; i<width; i++){
        if(mm[1][i].length>0){
            mm[0][1].push(i);
        }
    }

    let targets=new Array(width).fill(false);
    for(let i=0; i<width; i++){
        for(let j of mm[mm.length-2][i]){
            targets[j]=true;
        }
    }
    for(let i=0; i<width; i++){
        if(targets[i]){
            mm[mm.length-1][i]=[1];
        }
        else{
            mm[mm.length-1][i]=[];
        }
    }

    ctx.strokeStyle="#2f2f2f";
    ctx.lineWidth=4;
    let yPos=mapPaddingX/2;

    let mapNodes=[];
    // let nodeArray=[];
    for(let i=0; i<mm.length; i++){
        let xPos=mapPaddingY/2;
        mapNodes[i]=[];
        for(let j=0; j<width; j++){
            if(mm[i][j].length>0){
                mapNodes[i][j]=new MapNode(xPos, c.height-yPos);
                // nodeArray.push(mapNodes[i][j]);
            }
            xPos+=xSpacing;
        }
        yPos+=ySpacing;
    }
    const end=new MapNode(mapPaddingX/2+xSpacing, c.height-yPos);
    mapNodes.push([null,end,null]);
    // nodeArray.push(end);

    for(let i=0; i<mm.length; i++){
        for(let j=0; j<width; j++){
            if(mapNodes[i][j]){
                for(let k of mm[i][j]){
                    // if(mapNodes[i+1][k]==null){
                    //     debugger;
                    // }
                    // else{
                    mapNodes[i][j].fwd.push(mapNodes[i+1][k]);
                    mapNodes[i+1][k].back.push(mapNodes[i][j]);
                    // }
                }
            }
        }
    }

    let totalLots=0;
    let lots=[];
    for(let i=0; i<nodeTypes.length; i++){
        const prob=nodeTypes[i].lots();
        totalLots+=prob;
        lots.push(prob);
    }
    for(let i=1; i<mapNodes.length-1; i++){
        let remaining=totalLots;
        let picked=[];
        let skipped=new Array(lots.length).fill(false);
        // let vis=[];
        // for(let j=0; j<width; j++){
        //     if(mapNodes[i][j]){
        //         vis.push(j);
        //     }
        // }

        // for(let j=0; j<vis.length; j++){
        for(let j=0; j<width; j++){
            const rng=Math.random()*remaining;
            let curr=0,ind=0;
            for(; curr<rng; ind++){
                if(!skipped[ind]) curr+=lots[ind];
            }
            ind--;
            picked.push(ind);
            remaining-=lots[ind];
            skipped[ind]=true;
        }

        shuffle(picked);
        // for(let j=0; j<vis.length; j++){
        //     const n=mapNodes[i][vis[j]];
        //     n.type=nodeTypes[picked[j]];
        //     if(n.type==buildNode){
        //         n.y+=2;
        //     }
        // }
        for(let j=0; j<width; j++){
            const n=mapNodes[i][j];
            if(n){
                n.type=nodeTypes[picked[j]];
                if(n.type==buildNode){
                    n.y+=2;
                }
            }
        }
    }
    mapNodes[0][1].type=battleNode;
    mapNodes[mapNodes.length-1][1].type=battleNode;

    const skip=30;
    let currNode=mapNodes[0][1];

    for(let i=0; i<mapNodes.length; i++){
        for(let j=0; j<width; j++){
            const node=mapNodes[i][j];
            if(!node) continue;
            await node.type.src.loaded;

            const imx=Math.round(node.x-node.type.src.width/2);
            const imy=Math.round(node.y-node.type.src.height/2);

            let tt=sigilElement(node.type,"img");
            d.appendChild(tt);
            tt.style.position="absolute";
            tt.style.left=imx+"px";
            tt.style.top=imy+"px";
            tt.width=node.type.src.width;
            tt.height=node.type.src.height;
            if(i==1) tt.style.cursor="pointer";
            // tt.getContext("2d").drawImage(node.type.src,0,0);
            tt.src=node.type.src.src;
            node.el=tt;

            if(i>0){
                tt.addEventListener("click",async function(){
                    if(currNode && currNode.fwd.indexOf(node)!=-1){
                        const old=currNode;
                        currNode=node;
                        await node.type.fn();

                        old.el.classList.remove("currentNode");
                        old.el.style.cursor="";
                        old.el.classList.add("pastNode");
                        node.el.classList.add("currentNode");
                        for(let n of node.fwd){
                            n.el.style.cursor="pointer";
                        }

                        for(let j=0; j<width; j++){
                            const n=mapNodes[i][j];
                            if(n && n!=node){
                                n.el.classList.add("pastNode");
                                n.el.style.cursor="";
                            }
                        }
                    }
                });
            }
            else{
                tt.classList.add("currentNode");
            }

            for(let f of node.fwd){
                const ang=Math.atan2(f.y-node.y,f.x-node.x);
                let skip_ini=node.type==buildNode? skip+10*Math.abs(Math.cos(ang)): skip;
                let skip_end=f.type==buildNode? skip+10*Math.abs(Math.cos(ang)): skip;
                const sx_ini=Math.cos(ang)*skip_ini,sy_ini=Math.sin(ang)*skip_ini;
                const sx_end=Math.cos(ang)*skip_end,sy_end=Math.sin(ang)*skip_end;
                ctx.beginPath();
                ctx.moveTo(node.x+sx_ini,node.y+sy_ini);
                ctx.lineTo(f.x-sx_end,f.y-sy_end);
                ctx.stroke();
            }
        }
    }

    return d;
}

const heartDivs=map.querySelectorAll(".heart");
const deckDivs=map.querySelectorAll(".actual");
const deckShadows2=map.querySelectorAll(".shadow");

for(let i=0; i<2; i++){
    const r=filled_canvas(2,i_cards,[2,2]);
    deckDivs[i].appendChild(r);
}

function updateDeck(i){
    drawShadow(deckShadows2[i], i==1? run.oppDeckSize: run.deck.length);
}
function updateHPs(){
    for(let i=0; i<2; i++){
        heartDivs[i].textContent=run.life[i];
    }
}

deckDivs[0].style.cursor="pointer";
const deckViewer=map.querySelector("#spreadDeck");

let viewerIntv,shownCards=0,toggleShow=true;
let readyProm,pendingAnims=0;

function createTransporter(card, nc, myRect, targetRect) {
    const trans = document.createElement("div");
    trans.className = "transporter";
    map.appendChild(trans);
    trans.appendChild(card);
    void card.offsetHeight;
    trans.style.top = myRect.top + "px";
    trans.style.left = myRect.left + "px";
    void trans.offsetHeight;

    trans.style.transform = "rotateY(180deg)";
    trans.style.top = targetRect.top + "px";
    trans.style.left = targetRect.left + "px";
    setTimeout(function () {
        trans.replaceChild(nc, card);
    }, 100);

    return trans;
}

deckDivs[0].addEventListener("click",async function(){
    if(readyProm) return;
    clearInterval(viewerIntv);
    if(pendingAnims!=0){
        await new Promise((resolve)=>{
            readyProm=resolve;
        });
        readyProm=null;
    }

    if(toggleShow){
        toggleShow=false;
        deckViewer.style.width=cardWidth*2*Math.max(3,Math.ceil(run.deck.length/3))+"px";
        viewerIntv=setInterval(function(){
            if(shownCards==run.deck.length) return;

            const card=copyCanvas(deckDivs[0].firstElementChild);
            const nc=run.deck[shownCards].render(2);

            shownCards++;
            if(shownCards==run.deck.length){
                clearInterval(viewerIntv);
                viewerIntv=null;
                deckDivs[0].firstElementChild.style.visibility="hidden";
            }
            else{
                drawShadow(deckShadows2[0], run.deck.length-shownCards);
            }

            pendingAnims++;
            const placeholder=document.createElement("div");
            placeholder.style.width=card.width+"px";
            placeholder.style.height=card.height+"px";
            deckViewer.appendChild(placeholder);
            const targetRect=placeholder.getBoundingClientRect();
            const myRect=deckDivs[0].firstElementChild.getBoundingClientRect();

            const trans=createTransporter(card,nc,myRect, targetRect);
        
            setTimeout(function(){
                deckViewer.replaceChild(nc,placeholder);
                trans.remove();
                pendingAnims--;
                if(readyProm && pendingAnims==0){
                    readyProm();
                }
            },200);
        },50);
    }
    else{
        toggleShow=true;

        viewerIntv=setInterval(function(){
            if(shownCards==0) return;

            shownCards--;
            const card=deckViewer.children[shownCards];
            if(shownCards==0){
                clearInterval(viewerIntv);
                viewerIntv=null;
                deckDivs[0].firstElementChild.style.visibility="hidden";
                hoveredTT=null;
                tooltip.style.opacity=0;
                tooltip.style.visibility="hidden";
            }

            if(!card) return;
            const nc=copyCanvas(deckDivs[0].firstElementChild);
            const pickedCards=shownCards;

            pendingAnims++;
            const targetRect=deckDivs[0].firstElementChild.getBoundingClientRect();
            const myRect=card.getBoundingClientRect();

            const trans=createTransporter(card,nc,myRect,targetRect);
        
            setTimeout(function(){
                drawShadow(deckShadows2[0], run.deck.length-pickedCards);
                deckDivs[0].firstElementChild.style.visibility="";
                trans.remove();
                pendingAnims--;
                if(readyProm && pendingAnims==0){
                    readyProm();
                }
            },200);
        },50);
    }
});

let trials=[];
class Trial{
    constructor(reducer,file,amount){
        this.reducer=reducer;
        this.amount=amount;

        if(!(file in imgMap)){
            imgMap[file]=new ImgWrapper("map/"+file);
        }
        this.file=imgMap[file];
        trials.push(this);
    }
}

const trialBones=new Trial(((c)=>c.getElement()==bones? c.cost: 0),"Trial_bones.webp",4);
const trialAttack=new Trial(((c)=>c.getAttack()),"Trial_power.webp",5);
const trialHealth=new Trial(((c)=>c.getHealth()),"Trial_toughness.webp",7);
const trialBlood=new Trial(((c)=>c.getElement()==blood? c.cost: 0),"Trial_blood.webp",3);
const trialEnergy=new Trial(((c)=>c.getElement()==energy? c.cost: 0),"trial_energy.png",3);
const trialSigils=new Trial(((c)=>c.getVisibleSigils().length),"Trial_abilities.webp",3);

async function showTrials(){
    shuffle(trials,3);
    for(let i=trials.length-3,j=0; i<trials.length; i++,j++){
        const trial=trials[i];
        pickSpaces[j].innerHTML="";
        
        await trial.file.loaded;
        const trialCard=document.createElement("div");
        trialCard.className="trial";
        pickSpaces[j].appendChild(trialCard);

        const img=trial.file.cloneNode();
        trialCard.appendChild(img);

        // const number=document.createElement("canvas");
        // number.width=4*i_numbers.dims[0];
        // number.height=4*i_numbers.dims[1];
        // i_numbers.draw(number.getContext("2d"),4,trial.amount,0,0,0);
        const number=document.createElement("span");
        number.textContent=trial.amount;
        trialCard.appendChild(number);
    }
}

function playTrial(i){

}