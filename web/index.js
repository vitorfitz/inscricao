"use strict"

const scaleCanvas=document.querySelector("#scales");
const cardSpacesBase=[
    document.querySelectorAll("#myBoard .space"),
    document.querySelectorAll("#oppBoard .space"),
];
const boards=[document.querySelector("#myBoard"),document.querySelector("#oppBoard")]
const boardOverlaysBase=[
    document.querySelectorAll("#myBoard .overlays"),
    document.querySelectorAll("#oppBoard .overlays"),
];
const deckSpaces=[
    document.querySelectorAll("#myDecks .actual"),
    document.querySelectorAll("#oppDecks .actual"),
];
const energyBars=[
    document.querySelectorAll("#myEnergy>*"),
    document.querySelectorAll("#oppEnergy>*"),
];
const boneSpans=[
    document.querySelector("#myBones span"),
    document.querySelector("#oppBones span"),
];
const hands=[
    document.querySelector("#myCards"),
    document.querySelector("#oppCards"),
];

let deckPiles=[[null,null],[null,null]]
let cardSpaces=null,boardOverlays=null;

function updateBones(s,g=game){
    boneSpans[+(s!=g.myTurn)].textContent="x"+g.bones[s];
}
function spendEnergy(amt,turn=game.turn){
    const e=game.energy[turn];
    game.energy[turn]-=amt;
    const uiTurn=+(turn!=game.myTurn);
    for(let i=6-e; i<6-e+amt; i++){
        energyBars[uiTurn][i].src="icons/energy_empty.png";
    }
}
function spendResource(el,cost,turn=game.turn){
    if(el==bones){
        game.bones[turn]-=cost;
        updateBones(turn);
    }
    else if(el==energy){
        spendEnergy(cost,turn);
    }
}

function checkCost(element,cost){
    if(element==blood){
        let total=0;
        for(let i=0; i<game.lanes; i++){
            let c=game.board[game.myTurn][i];
            if(c!=null){
                let blood=1;
                if(c.unsaccable){
                    blood=0;
                }
                else if(c.card.hasSigil(s_worthy)){
                    blood=3;
                }
                total+=blood;
            }
        }
        return total>=cost;
    }
    else if(element==bones){
        return game.bones[game.myTurn]>=cost;
    }
    else if(element==energy){
        return game.energy[game.myTurn]>=cost;
    }
}

function updateBlockActions(){
    if(selectedCard!=null){
        if(blockActions==0 || !isSaccing) boards[0].classList.add("spacesClickable");
        else boards[0].classList.remove("spacesClickable");
    }
    if(blockActions==0){
        hands[0].classList.add("cardsClickable");
        bell.classList.add("selectable");
        hammer.classList.add("selectable");
    }
    else{
        hands[0].classList.remove("cardsClickable");
        bell.classList.remove("selectable");
        hammer.classList.remove("selectable");
    }
}

const basePath="/rips/";
let num_loaded=0,ss=[];

class SpriteSheet{
    constructor(src,w,h,pw,ph){
        this.img=new Image();
        this.img.src=basePath+src;
        this.dims=[w,h];
        this.skip=[w+pw,h+ph];

        ss.push(this);
        this.loaded=false;

        // Check if the image has finished loading
        this.img.onload = () => {
            this.loaded=true;
            num_loaded++;
        };
    }

    draw(canvas,scale,x,y,locX,locY){
        if (num_loaded<ss.length) {
            for(let i=0; i<ss.length; i++){
                if(!ss[i].loaded){
                    let oldOnload=ss[i].img.onload;
                    ss[i].img.onload = () => {
                        oldOnload();
                        if(num_loaded==ss.length) this.draw(canvas, scale, x, y, locX, locY);
                    };
                }
            }
            return;
        }

        canvas.imageSmoothingEnabled=false;
        canvas.drawImage(this.img,
            this.skip[0]*x,  this.skip[1]*y, this.dims[0], this.dims[1],
            locX*scale, locY*scale, this.dims[0]*scale, this.dims[1]*scale,
        );
    }
}

const cardWidth=42,cardHeight=56;
const i_numbers=new SpriteSheet("text.png",5,6,1,1);
const i_costs=new SpriteSheet("costs.png",26,13,1,3);
const i_sigils=new SpriteSheet("sigils.png",17,17,1,1);
const i_stats=new SpriteSheet("stats.png",10,15,1,1);
const i_act=new SpriteSheet("activated_sigils.png",22,10,1,1);
const i_portraits=new SpriteSheet("portraits.png",40,28,3,2);
const i_cards=new SpriteSheet("cards.png",cardWidth,cardHeight,2,2);

const i_colored_nums=[
    i_numbers,
    new SpriteSheet("text_red.png",5,6,1,1),
    new SpriteSheet("text_green.png",5,6,1,1),
]

const blackText=0,redText=1,greenText=2;
const bones=0,blood=1,energy=3;

function getBG(unsac){
    if(unsac){
        return[2,1];
    }
    else{
        return[1,0];
    }
}

function calcCenterX(width){
    return (cardWidth-width)/2;
}
const act_alignX=calcCenterX(i_act.dims[0]);
const sig_alignX=calcCenterX(i_sigils.dims[0]);
const sig_alignX2=calcCenterX(2*i_sigils.dims[0]+1);
const atk_alignX=2
const hp_alignX=cardWidth-atk_alignX-i_numbers.dims[0];
const cost_alignX=cardWidth-i_costs.dims[0];

const act_alignY=31;
const sig_alignY=31;
const stats_alignY=cardHeight-2-i_numbers.dims[1];

let game;

const listen_me=0,listen_ally=1,listen_enemy=2,listen_any=3;
class Listener{
    constructor(type,func,prio=0){
        this.type=type;
        this.func=func;
        this.prio=prio;
    }
}

class GameSigil{
    constructor(sigil){
        this.funcs=sigil;
        this.data=null;
        this.el=null;
    }
}
class GameActivated extends GameSigil{
    constructor(sigil){
        super(sigil);
        this.enabled=false;
    }
}

const sigilCoords=[];
const coordsSet=new Set();
function initDirection(card,gs){
    const old=game.board[card.side][card.pos];
    let direction;
    if(old!=null){
        for(let s of old.sigils){
            if(s.funcs.initData==initDirection){
                direction=s.data.direction;
            }
        }
    }
    else{
        direction=1-2*card.side;
    }

    gs.el.style.transition="transform 200ms linear";
    moverTrans(gs.el,direction);
    return{direction,el:gs.el};
}

s_bomb.init([0,0],"Bomb Spewer","Invoca bombas que destroem cartas adjacentes em todos os espaços vazios.");
s_bomb.onCardPlayed.push(new Listener(listen_me,async function(){
    for(let i=0; i<2; i++){
        for(let j=game.starts[game.turn]; j!=game.ends[game.turn]; j+=dirs[game.turn]){
            if(game.board[i][j]==null){
                await (GameCard.fromCard(c_explode_bot,true)).place(j,i);
            }
        }
    }
}))

s_digger.init([1,0],"Bone Digger","Ganha 1 osso no começo do turno.");
s_digger.onTurnEnded.push(new Listener(listen_ally,async function(){
    game.bones[game.turn]++;
    updateBones(game.turn);
}))

s_brittle.init([2,0],"Brittle","Morre após atacar.");
s_brittle.onDealtAttack=function(me){ me.die(); }

s_bifurcated.init([6,0],"Bifurcated Strike","Ataca os espaços à direita e esquerda em vez do espaço à frente.");
s_bifurcated.modifyTargets=function(me){
    if(game.targets[game.targets.length-1]==me.pos) game.targets.pop();
    for(let i=me.pos-dirs[game.turn],j=0; j<2; i+=2*dirs[game.turn],j++){
        if(i>=0 && i<game.lanes) game.targets.push(i)
    }
}

s_death_touch.init([2,1],"Death Touch","Mata qualquer criatura que sofrer dano desta.");
s_death_touch.onDealtDmg=function(dmg,_,opp){
    return opp.health;
}

s_double_death.init([3,1],"Double Death","Efeitos de morte aliados ativam duas vezes.");
s_double_death.onCardDied.push(new Listener(listen_ally,async function(me, them){
    if(me.card!=them.card){
        for(let s of them.sigils){
            for(let f of s.funcs.onCardDied){
                if(f.type==listen_me) await f.func(them,them,s.data);
            }
        }
        game.bones[me.side]++;
        updateBones(me.side);
        for(let l of game.deathListeners[me.side]){
            if(l.caller!=me) l.func(l.caller,them,l.data);
        }
        // them.die();
    }
}))

s_fecundity.init([4,1],"Fecundity","Cria uma cópia na sua mão ao ser jogada.");
s_fecundity.onCardPlayed.push(new Listener(listen_me,async function(me){
    await game.addCardToHand(me.card,undefined,undefined,true);
}))

s_undying.init([5,1],"Undying","Volta para sua mão quando morre.");
s_undying.onCardDied.push(new Listener(listen_me,async function(me){
    await game.addCardToHand(me.card,me.side);
}))

s_ouroboros.init([5,1],"Undying++","Volta para sua mão com +1/1 quando morre.");
s_ouroboros.onCardDied.push(new Listener(listen_me,async function(me){
    await game.addCardToHand(me.card,me.side,function(newMe){
        newMe.attack=me.baseAttack+1;
        newMe.health=me.baseHealth+1;
        newMe.baseAttack=newMe.attack;
        newMe.baseHealth=newMe.health;
        newMe.updateStat(0,newMe.attack);
        newMe.updateStat(1,newMe.health);
    })
}))

s_sq_spawner.init([6,1],c_squirrel,"Squirrel Shedder","Move no fim do turno e cria um esquilo onde estava.");

s_rabbit.init([1,2],"Rabbit Hole","Adiciona um coelho 0/1 de custo 0 na sua mão.");
s_rabbit.onCardPlayed.push(new Listener(listen_me,async function(){
    game.addCardToHand(c_rabbit,undefined,undefined,true,true);
}))

// s_wolf_cub.init(c_wolf);
s_elk_fawn.init(c_elk,"Fledgling","Se torna um Cervo 2/4 no próximo turno.");
s_raven_egg.init(c_raven,"Fledgling","Se torna um Corvo 2/3 voador no próximo turno.");
s_sarc.init(c_mummy_lord,"Fledgling","Se torna uma Múmia 3/4 no próximo turno.");

// s_armored.init([],function(){return{shield:true};});
// s_armored.onReceivedDmg.push(new Listener(listen_me,async function(dmg,_,_,memory){
//     if(memory.shield){ memory.shield=false; return 0; }
//     return dmg;
// }));

s_explosive.init([4,2],"Detonator","Ao morrer causa 10 de dano às cartas adjacentes (na vertical e horizontal).");
s_explosive.onCardDied.push(new Listener(listen_me,async function(me,them){
    if(game.board[1-me.side][me.pos]!=null){
        game.board[1-me.side][me.pos].damage(10,me);
    }
    for(let i=-dirs[me.side],j=0; j<2; i+=2*dirs[me.side],j++){
        let c=me.pos+i;
        if(c>=0 && c<game.lanes){
            if(game.board[me.side][c]!=null) game.board[me.side][c].damage(10,me);
        }
    }
}));

s_flying.init([0,3],"Airborne","Ataca o oponente diretamente.");
s_flying.onDealtAttack=function(me,them){
    game.canBlock=false;
};

s_energy.init([1,3],"Battery Bearer","Ganha 1 de energia máxima.");
s_energy.onCardPlayed.push(new Listener(listen_me,async function(){
    if(game.maxEnergy[game.turn]<6){
        game.maxEnergy[game.turn]++;
    }
    if(game.energy[game.turn]<6){
        const uiTurn=+(game.turn!=game.myTurn);
        game.energy[game.turn]++;
        energyBars[uiTurn][6-game.energy[game.turn]].src="icons/energy_full.png";
    }
}));

s_guardian.init([2,4],"Guardian","Quando o oponente joga uma carta contra um espaço vazio, move para bloqueá-la.");
s_guardian.onCardPlayed.push(new Listener(listen_enemy,async function(me,them){
    if(game.board[me.side][them.pos]==null){
        game.board[me.side][me.pos]=null;
        await me.place(them.pos,me.side);
    }
}));

s_frozen_skele.init(c_skeleton,"Frozen Away","Invoca um esqueleto 1/1 ao morrer.");

s_push.init([6,4],"Hefty","Move no fim do turno, empurrando outras cartas.",initDirection);
function canPush(me,dir){
    let t=dir==-1? 1: 0;
    for(let i=me.pos; i!=game.ends[t]; i+=dir){
        if(game.board[game.turn][i]==null){
            return i;
        }
    }
    return -1;
}
s_push.onTurnEnded.push(new Listener(listen_ally,async function(me,memory){
    let p=canPush(me,memory.direction);
    if(p==-1){
        memory.direction*=-1;
        moverTrans(memory.el,memory.direction);
        p=canPush(me,memory.direction);
    }
    if(p!=-1){
        let freeze=me.pos;
        for(let i=p; i!=freeze; i-=memory.direction){
            await game.board[game.turn][i-memory.direction].place(i);
        }
    }
}))

s_bones.init([0,5],"Bone King","Dá 4 ossos quando morre em vez de 1.");
s_bones.onCardDied.push(new Listener(listen_me,async function(me){
    game.bones[me.side]+=3;
    updateBones(me.side);
}))

s_reach.init([1,5],"Mighty Leap","Bloqueia cartas voadoras.");
s_reach.onReceivedAttack.push(new Listener(listen_me,async function(me){
    game.canBlock=true;
}))

s_free_sac.init([2,5],"Many Lives","Quando é sacrificada, em vez de morrer perde 1 de vida.");

s_quills.init([4,5],"Sharp Quills","Causa 1 de dano a quem a ataca.");
s_quills.onReceivedAttack.push(new Listener(listen_me,async function(me,them){
    them.damage(1,me);
    await game.sleep(500);
}))

s_skele_spawner.init([5,5],c_skeleton,"Skeleton Crew","Move no fim do turno, deixando um esqueleto onde estava.");

s_aquatic.init([6,5],"Waterborne","Não bloqueia ataques.");
s_aquatic.onReceivedAttack.push(new Listener(listen_me,async function(me){
    game.canBlock=false;
}))

s_worthy.init([1,6],"Worthy Sacrifice","Conta como 3 criaturas ao ser sacrificada.");

s_trifurcated.init([2,6],"Trifurcated Strike","Ataca 3 vezes: esquerda, frente e direita.");
s_trifurcated.modifyTargets=function(me){
    if(game.targets[game.targets.length-1]==me.pos) game.targets.pop();
    for(let i=me.pos-dirs[game.turn]; i!=me.pos+2*dirs[game.turn]; i+=dirs[game.turn]){
        if(i>=0 && i<game.lanes) game.targets.push(i)
    }
}

const tutorModal=document.querySelector("#tutorWrapper");
const tutorDiv=document.querySelector("#tutor");
s_tutor.init([3,6],"Hoarder","Ao jogar, compre uma carta do seu deck à sua escolha.");
s_tutor.onCardPlayed.push(new Listener(listen_me, async function(me){
    if(me.side==game.myTurn){
        if(game.deck.length>0){
            console.log(blockActions);
            await game.sleep(200);

            tutorModal.style.visibility="visible";
            tutorModal.style.opacity=1;
            console.log(blockActions);

            for(let i=0; i<game.deck.length; i++){
                if(i%6==0 && i!=0){
                    tutorDiv.appendChild(document.createElement("br"));
                }
                const card=cards[game.deck[i]];
                const c=card.render(2);
                tutorDiv.appendChild(c);

                let closure_i=i;
                c.addEventListener("click",function(){
                    console.log(blockActions);
                    tutorModal.style.opacity=0;
                    tutorModal.style.visibility="hidden";
                    game.addCardToHand(card);

                    game.deck.splice(closure_i,1);
                    shuffle(game.deck);
                    drawDeckShadow(0,0,game.deck.length);

                    setTimeout(function(){
                        tutorDiv.innerHTML="";
                        tooltip.style.opacity=0;
                        tooltip.style.visibility="hidden";
                    },150);
                });
            }
        }
    }
    else{
        if(game.oppCardsLeft>0) game.drawCard(0,me.side);
    }
}))

s_burrow.init([4,6],"Burrower","Quando um espaço vazio seu é atacado, se move para defendê-lo.");
s_burrow.onFaceDmg.push(new Listener(listen_ally, async function(dmg,me,attacker,target){
    if(!me.card.hasSigil(s_reach) && attacker.card.hasSigil(s_flying)){
        return dmg;
    }
    if(game.board[me.side][target]==null){
        game.board[me.side][me.pos]=null;
        game.clrTimeout(game.attackTimeout);
        await me.place(target,me.side);
        await attacker.hit(me);
        return 0;
    }
    return dmg;
}))

s_sidestep.init([5,6],null,"Sprinter","Move no fim do seu turno.");

s_sniper.init([6,6],"Sniper","Você escolhe onde essa carta ataca.");
s_sniper.modifyTargets=function(me){
    for(let i=0; i<game.targets; i++){
        // target prompt
    }
}

s_blood_lust.init([0,7],"Blood Lust","Ganha +1 ataque ao matar uma carta.",function(){
    return{amAttacking:false};
});
s_blood_lust.onReceivedAttack.push(new Listener(listen_enemy,async function(me,opp,attacker,memory){
    memory.amAttacking=attacker==me;
}))
s_blood_lust.onCardDied.push(new Listener(listen_enemy,async function(me,opp,memory){
    if(memory.amAttacking && game.turn==me.side){
        me.attack++;
    }
}))

s_dam.init([1,7],"Dam Builder","Invoca Represas 0/2 nos espaços adjacentes. Elas bloqueiam cartas voadoras.");
s_dam.onCardPlayed.push(new Listener(listen_me,async function(me){
    for(let i=me.pos-dirs[game.turn],j=0; j<2; i+=2*dirs[game.turn],j++){
        if(i>=0 && i<game.lanes && game.board[me.side][i]==null){
            await (GameCard.fromCard(c_dam,true)).place(i);
        }
    }
}))

s_beehive.init([2,7],"Bees Within","Quando toma dano, adiciona uma abelha 1/1 voadora de custo 0 à sua mão.");
s_beehive.onReceivedDmg.push(new Listener(listen_me,async function(dmg,me){
    await game.addCardToHand(c_bee,me.side,undefined,undefined,true);
    return dmg;
}))

// s_corpse_eater.init([3,7]);

s_bells.init([4,7],"Bellist","Invoca Sinos 0/1 nos espaços adjacentes. Ataca quem quebrar esses sinos.");
s_bells.onCardPlayed.push(new Listener(listen_me,async function(me){
    for(let i=me.pos-dirs[game.turn],j=0; j<2; i+=2*dirs[game.turn],j++){
        if(i>=0 && i<game.lanes && game.board[me.side][i]==null){
            await (GameCard.fromCard(c_bell,true)).place(i);
        }
    }
}))
s_bells.onReceivedAttack.push(new Listener(listen_ally,async function(me,attacker,target){
    if(target.card==c_bell){
        moveForward(me.canvas,me.pos,+(me.side==game.myTurn),attacker.pos);
        setTimeout(function(){
            me.canvas.style.transform="";
        },200);

        await game.sleep(100);
        await me.hit(attacker);
    }
}))

s_extra_attack.init([5,7],"Extra Attack","Ataca 2 vezes.");
s_extra_attack.modifyTargets=function(me){
    game.targets.push(me.pos);
}

s_alpha.init([6,7],function(sign,me,pos){
    for(let i=pos-dirs[me.side],j=0; j<2; i+=2*dirs[me.side],j++){
        if(i>=0 && i<game.lanes){
            game.updateBuffs(me.side,i,sign);
        }
    }
},"Leader","Suas cartas adjacentes ganham +1 ataque.");

s_stinky.init([0,8],function(sign,me,pos){
    game.updateBuffs(1-me.side,pos,-sign);
},"Stinky","Reduz em 1 o ataque da carta na frente desta.");

s_cant_be_sacced.init();

s_hand.init([0,0],null,"Número de cartas na sua mão.");
s_hand.onCardPlayed.push(new Listener(listen_me,async function(me){
    me.attack=me.side==game.myTurn? game.hand.length: game.oppCards;
    me.updateStat(0,me.attack);
}));
s_hand.onCardDrawn.push(new Listener(listen_ally,async function(me){
    me.attack++;
    me.updateStat(0,me.attack);
}));
s_hand.onCardPlayed.push(new Listener(listen_ally,async function(me){
    me.attack--;
    me.updateStat(0,me.attack);
}));

s_mirror.init([1,0],null,"Copia o ataque da carta à frente desta.");
function updateMirror(me){
    const opposite=game.board[1-me.side][me.pos];
    const old=me.attack;
    me.attack=opposite==null? 0: opposite.attack;
    if(me.attack!=old) me.updateStat(0,me.attack);
}

s_mirror.onCardPlayed.push(new Listener(listen_me,async function(me){
    updateMirror(me);
}));
s_mirror.onCardMoved.push(new Listener(listen_me,async function(me){
    updateMirror(me);
}));
s_mirror.onCardMoved.push(new Listener(listen_enemy,async function(me){
    updateMirror(me);
},-1));
s_mirror.onCardDied.push(new Listener(listen_enemy,async function(me,dead){
    if(dead.pos==me.pos){
        const old=me.attack;
        me.attack=0;
        if(old!=0) me.updateStat(0,me.attack);
    }else updateMirror(me);
},-1));
s_mirror.onTurnEnded.push(new Listener(listen_any,async function(me){
    updateMirror(me);
},-1));

const cards=[];
const allCards=[];
const tooltip=document.querySelector("#tooltip");
let hoveredTT=null;

c_squirrel.init("Squirrel",0,0,1,blood,[],null,[8,5],false);
c_skeleton.init("Skeleton",0,1,1,bones,[s_brittle],null,[7,11],false);
const manas=[c_squirrel,c_skeleton];

c_hopper.init("Curve Hopper",4,2,1,energy,[],null,[0,0]);
c_adder.init("Adder",2,1,2,blood,[s_death_touch],null,[1,0]);
c_automaton.init("Automaton",2,1,1,energy,[],null,[2,0]);
c_banshee.init("Banshee",1,1,1,bones,[s_flying],null,[3,0]);
c_energy_bot.init("Energy Bot",2,0,1,energy,[s_energy],null,[4,0]);
c_bloodhound.init("Bloodhound",2,2,4,blood,[s_guardian],null,[5,0]);
c_bolthound.init("Bolthound",5,2,3,energy,[s_guardian],null,[0,1]);
c_explode_bot.init("Explode Bot",4,1,1,energy,[s_explosive],null,[1,1]);
c_mrs_bomb.init("Mrs. Bomb",5,5,5,energy,[s_bomb],null,[2,1]);
c_bonehound.init("Bonehound",4,2,4,bones,[s_guardian],null,[3,1]);
c_bullfrog.init("Bullfrog",1,1,2,blood,[s_reach],null,[6,1]);
c_sniper.init("Sniper Bot",3,1,1,energy,[s_sniper],null,[8,1]);
c_cat.init("Cat",1,0,1,blood,[s_free_sac],null,[0,2]);
c_coyote.init("Coyote",2,1,3,bones,[],null,[0,3]);
c_pharaoh.init("Pharaoh's Pets",5,0,1,bones,[s_free_sac,s_worthy],null,[2,3]);
c_draugr.init("Draugr",1,0,2,bones,[s_frozen_skele,s_cant_be_sacced],null,[3,3]);
c_drowned.init("Drowned Soul",4,1,1,bones,[s_aquatic,s_death_touch],null,[4,3]);
c_elk.init("Elk",2,2,4,blood,[s_sidestep],null,[5,3]);
c_elk_fawn.init("Elk Fawn",1,1,1,blood,[s_elk_fawn,s_sidestep],null,[6,3]);
c_family.init("The Walkers",4,1,3,bones,[s_bones],null,[2,4]);
c_mice.init("Field Mice",2,2,2,blood,[s_fecundity],null,[3,4]);
c_frank_stein.init("Frank & Stein",3,2,2,bones,[],null,[7,4]);
c_ghost_ship.init("Ghost Ship",3,0,1,bones,[s_skele_spawner,s_aquatic],null,[2,5]);
c_gravedigger.init("Gravedigger",2,0,3,bones,[s_digger],null,[3,5]);
c_grizzly.init("Grizzly",3,4,5,blood,[],null,[6,5]);
c_gunner.init("Double Gunner",6,2,1,energy,[s_bifurcated],null,[7,5]);
c_hawk.init("Hawk",2,3,1,blood,[s_flying],null,[0,6]);
c_hrokkall.init("Hrokkall",1,1,1,blood,[s_aquatic,s_energy],null,[2,6]);
c_insectodrone.init("Insectodrone",3,1,2,energy,[s_flying],null,[3,6]);
c_kingfisher.init("Kingfisher",1,1,1,blood,[s_flying,s_aquatic],null,[6,6]);
c_squirrel_ball.init("Squirrel Ball",1,1,1,blood,[s_sq_spawner],null,[8,6]);
c_l33pbot.init("L33pbot",1,0,2,energy,[s_reach],null,[0,7]);
c_magpie.init("Magpie",2,1,1,blood,[s_flying,s_tutor],null,[2,7]);
// mantis god
// meat bot
c_49er.init("49er",2,1,1,energy,[s_sidestep],null,[2,8]);
c_mole.init("Mole",1,0,5,blood,[s_burrow],null,[3,8]);
c_mole_man.init("Mole Man",1,0,4,blood,[s_burrow,s_reach],null,[4,8]);
c_steambot.init("Steambot",6,3,2,energy,[],null,[8,8]);
c_mummy_lord.init("Mummy Lord",5,3,4,bones,[],null,[4,9]);
c_necromancer.init("Necromancer",3,1,2,bones,[s_double_death],null,[6,9]);
c_ouroboros.init("Ouroboros",2,1,1,blood,[s_ouroboros],null,[2,10]);
c_rabbit.init("Rabbit",0,0,1,bones,[],null,[5,10],false);
c_raven.init("Raven",2,2,3,blood,[s_flying],null,[6,10]);
c_revenant.init("Revenant",2,3,1,bones,[s_brittle],null,[7,10]);
c_stoat.init("Stoat",1,1,3,blood,[],null,[8,10]);
c_steel_mice.init("Steel Mice",6,1,2,energy,[s_fecundity],null,[0,11]);
c_salmon.init("Salmon",2,2,2,blood,[s_aquatic,s_sidestep],null,[2,11]);
c_sarcophagus.init("Sarcophagus",3,0,3,bones,[s_sarc],null,[3,11]);
c_thicc.init("Thick Droid",4,1,3,energy,[],null,[8,11]);
c_477.init("Urayuli",4,7,7,blood,[],null,[1,12]);
c_warren.init("Warren",1,0,3,blood,[s_rabbit],null,[2,12]);
c_wolf.init("Wolf",2,3,2,blood,[],null,[3,12]);
// wolf cub
c_zombie.init("Zombie",1,1,1,bones,[],null,[5,12]);
c_cockroach.init("Cockroach",3,1,1,bones,[s_undying],null,[8,12]);
c_bat.init("Bat",3,2,1,bones,[s_flying],null,[0,13]);
c_beaver.init("Beaver",2,1,4,blood,[s_dam],null,[1,13]);
c_dam.init("Dam",0,0,2,bones,[s_reach,s_cant_be_sacced],null,[2,13],false);
c_bee.init("Bee",0,1,1,bones,[s_flying],null,[3,13],false);
c_beehive.init("Beehive",1,0,2,blood,[s_beehive],null,[4,13]);
c_black_goat.init("Black Goat",2,0,4,blood,[s_worthy],null,[5,13]);
// child 13
c_daus.init("The Daus",2,2,1,blood,[s_bells],null,[7,13]);
c_bell.init("Bell",0,0,1,blood,[s_cant_be_sacced],null,[8,13],false);
c_dire_wolf.init("Dire Wolf",3,2,4,blood,[s_extra_attack],null,[1,14]);
c_rat_king.init("Rat King",2,2,1,blood,[s_bones],null,[2,14]);
c_raven_egg.init("Raven Egg",1,0,2,blood,[s_raven_egg],null,[3,14]);
c_alpha.init("Alpha",4,1,3,bones,[s_alpha],null,[4,14]);
c_mantis.init("Mantis",1,1,1,blood,[s_bifurcated],null,[5,14]);
c_moose_buck.init("Moose Buck",3,3,7,blood,[s_push],null,[6,14]);
c_skunk.init("Skunk",1,0,3,blood,[s_stinky],null,[7,14]);
c_great_white.init("Great White",3,4,2,blood,[s_aquatic],null,[8,14]);
c_porcupine.init("Porcupine",1,1,2,blood,[s_quills],null,[0,15]);
// pronghorn
c_rattler.init("Rattler",4,3,2,bones,[],null,[2,15]);
c_river_snapper.init("River Snapper",2,1,7,blood,[],null,[3,15]);
c_sparrow.init("Sparrow",1,1,2,blood,[s_flying],null,[4,15]);
// strange larva
c_vulture.init("Turkey Vulture",6,3,5,bones,[s_flying],null,[7,15]);
c_bone_horn.init("Bone Lord's Horn",6,1,1,bones,[],a_bone_horn,[4,1]);
c_tomb_raider.init("Tomb Robber",1,0,1,bones,[],a_disentomb,[0,12]);
c_plasma.init("Plasma Jimmy",3,0,3,energy,[],a_energy_gun,[0,4]);
c_bone_heap.init("Bone Heap",1,0,2,bones,[],a_enlarge,[5,1]);
c_hand_tent.init("Hand Tentacle",2,0,4,blood,[s_hand],null,[8,3]);
c_mirror_tent.init("Mirror Tentacle",1,69,4,blood,[s_mirror],null,[8,4]);

// cartas act 3

a_bone_horn.init([4,0],1,energy,"Bone Horn","Gasta 1 energia: ganhe 3 ossos.",async function(card){
    game.bones[card.side]+=3;
    updateBones(card.side);
});

a_disentomb.init([3,0],1,bones,"Disentomb","Gasta 1 osso: invoca um esqueleto.",async function(card){
    let c=await game.addCardToHand(c_skeleton,card.side,undefined,undefined,true);
    if(c){
        selectCard(c);
        blockActions++;
        isSaccing=false;
        updateBlockActions();
    }
},function(card){
    for(let i=0; i<game.lanes; i++){
        if(game.board[card.side][i]==null) return true;
    }
    return false;
});

a_energy_gun.init([0,0],1,energy,"Energy Gun","Gasta 1 energia: causa 1 de dano à carta na frente.",async function(card){
    game.board[1-card.side][card.pos].damage(1,card);
},function(card){
    return game.board[1-card.side][card.pos]!=null;
});

a_enlarge.init([2,1],2,bones,"Enlarge","Gasta 2 ossos: Ganha +1/1.",async function(card){
    card.attack++;
    card.health++;
    card.baseAttack++;
    card.baseHealth++;
    card.updateStat(0,card.attack);
    card.updateStat(1,card.health);
});

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

class GameCard{
    static fromCard(c,unsac=false,attack=c.attack,health=c.health){
        let sigils=[];
        for(let i=0; i<c.sigils.length; i++){
            sigils.push(new GameSigil(c.sigils[i]));
        }
        let activated=c.activated? new GameActivated(c.activated): null;

        return new GameCard({
            card:c,
            attack,
            health,
            baseAttack:attack,
            baseHealth:health,
            unsaccable:unsac || c.hasSigil(s_cant_be_sacced),
            sigils: sigils,
            activated: activated
        })
    }

    toJSON(){
        return({
            card:this.card,
            attack:this.attack,
            health:this.health,
            baseAttack:this.baseAttack,
            baseHealth:this.baseHealth,
            unsaccable:this.unsaccable,
            sigils: this.sigils,
            activated:this.activated
        })
    }

    static toSocketLen=4;
    toSocket(){
        return[
            this.card.jsonID,
            this.baseAttack,
            this.baseHealth,
            +this.unsaccable,
        ];
    }

    constructor(params){
        const c=params.card;
        this.card=c;
        this.attack=params.attack;
        this.health=params.health;
        this.baseAttack=params.baseAttack;
        this.baseHealth=params.baseHealth;
        this.unsaccable=params.unsaccable;
        this.sigils=params.sigils;
        this.activated=params.activated;

        this.side=null;
        this.pos=null;
        this.inGame=false;
        this.clickEvent=null;

        const ret=c.renderAlsoReturnCtx(2,this.unsaccable);
        this.canvas=ret.div;
        this.ctx=ret.ctx;
        this.sigilEls=ret.sigilEls;
        if(this.unsaccable) this.canvas.classList.add("unsaccable");

        if(this.activated){
            const el=this.sigilEls[0];
            el.addEventListener("click",async function(){
                if(this.activated.enabled && blockActions==0){
                    blockActions++;
                    updateBlockActions();
                    sendMsg(codeActivated+" "+this.pos);
                    await this.activate();
                    blockActions--;
                    updateBlockActions();
                }
            }.bind(this));
        }
        else{
            let i=0;
            for(let j=0; j<c.sigils.length; j++){
                if(c.sigils[j].coords!=null){
                    this.sigils[j].el=this.sigilEls[i];
                    i++;
                }
            }
        }
    }

    async activate(){
        const el=this.sigilEls[0];
        el.classList.add("clicked");
        setTimeout(function(){
            el.classList.remove("clicked");
        },250);

        await this.activated.funcs.func(this,this.activated.data);
        await game.resolve();
    }

    updateStat(atkOrHp,stat){
        const scale=2;
        const alignX=[atk_alignX,hp_alignX][atkOrHp];
        let [cardX,cardY]=getBG(this.unsaccable);

        this.ctx.drawImage(i_cards.img,
            i_cards.skip[0]*cardX+alignX, i_cards.skip[1]*cardY+stats_alignY,
            i_numbers.dims[0], i_numbers.dims[1],
            alignX*scale, stats_alignY*scale,
            i_numbers.dims[0]*scale, i_numbers.dims[1]*scale,
        );

        if(stat<0) stat=0;
        else if(stat>9) stat=9;

        const baseline=[this.baseAttack,this.baseHealth][atkOrHp];
        let color;
        if(stat==baseline){
            color=blackText;
        }
        else if(stat<baseline){
            color=redText;
        }
        else{
            color=greenText;
        }

        i_colored_nums[color].draw(this.ctx,scale,stat,0,alignX,stats_alignY);
    }

    async play(pos,faceDown=null){
        spendResource(this.card.element,this.card.cost);
        if(game.turn==game.myTurn){
            const ind=game.hand.indexOf(this);
            if(ind!=-1) game.hand.splice(ind,1);
        }
        else{
            game.oppCards--;
        }

        blockActions++;
        updateBlockActions();

        if(faceDown!=null){
            playCard(faceDown,1,pos,this.canvas);
        }
        else{
            this.canvas.removeEventListener("click",this.clickEvent);
            this.clickEvent=null;
            unselectCard();
            playCard(this.canvas,0,pos);
        }

        this.side=game.turn;
        this.pos=pos;
        game.board[this.side][this.pos]=this;
        for(let l of [...game.playListeners[game.turn]]){
            await l.func(l.caller,this,l.data);
        }
        for(let s of this.sigils){
            for(let f of s.funcs.onCardPlayed){
                if(f.type==listen_me) await f.func(this,this,s.data);
            }
        }

        this.pos=null;
        await this.place(pos,game.turn,true);
        await game.resolve();

        blockActions--;
        updateBlockActions();
    }

    die(){
        game.deathQueue.push(this);
    }

    damage(dmg,src){
        game.dmgQueue.push({card: this,dmg,src});
    }

    async place(pos,t=game.turn,from_hand=false){
        this.side=t;
        let old_pos=this.pos;
        this.pos=pos;

        let prevBuff;
        if(old_pos==null){
            for(let s of this.sigils){
                s.data=s.funcs.initData(this,s);
            }
            prevBuff=0;
        }
        else{
            prevBuff=game.buffs[t][old_pos];
            game.board[t][old_pos]=null;
        }

        game.board[t][pos]=this;
        if(prevBuff!=game.buffs[t][pos]){
            this.attack-=prevBuff;
            this.attack+=game.buffs[t][pos];
            this.updateStat(0,this.attack);
        }

        if(!from_hand){
            const uiTurn=+(this.side!=game.myTurn);
            if(old_pos==null){
                materialize(this.canvas,uiTurn,pos);
                await game.sleep(250);
            }
            else{
                let dur=move(this.canvas,old_pos,uiTurn,pos);
                await game.sleep(dur);
            }
        }

        for(let s of this.sigils){
            for(let f of s.funcs.onCardMoved){
                if(f.type==listen_me) await f.func(this,old_pos,this,s.data);
            }
        }
        for(let l of [...game.movementListeners[t]]){
            await l.func(l.caller,old_pos,this,l.data);
        }

        if(old_pos==null){
            for(let s of this.sigils){
                for(let i=0; i<listenerRefs.length; i++){
                    const listeners=s.funcs[listenerFuncs[i]];
                    const pool=game[listenerRefs[i]];

                    for(let lis of listeners){
                        const obj={func: lis.func, caller: this, data: s.data, prio: lis.prio};
                        if([listen_ally,listen_any].includes(lis.type)) pool[this.side].push(obj);
                        if([listen_enemy,listen_any].includes(lis.type)) pool[1-this.side].push(obj);
                    }
                }
            }
        }

        this.inGame=true;
    }

    async hit(opp){
        for(let s of opp.sigils){
            for(let f of s.funcs.onReceivedAttack){
                if(f.type==listen_me) await f.func(opp,this,opp,s.data);
            }
        }
        for(let l of [...game.attackListeners[opp.side]]){
            await l.func(l.caller,this,opp,l.data);
        }

        if(game.canBlock){
            opp.damage(this.attack,this);
        }
        else{
            game.tiltScales(this.attack,this,opp.pos);
        }
    }

    async _attack(){
        if(this.attack<=0){
            return;
        }
        blockActions++;
        updateBlockActions();

        game.targets=[this.pos];
        for(let s of this.sigils){
            if(s.funcs.modifyTargets!=null){
                await s.funcs.modifyTargets(this);
            }
        }
        for(let t of game.targets){
            game.attackTimeout=attack(this.canvas,this.pos,+(this.side==game.myTurn),t);

            let opp=game.board[1-game.turn][t];
            game.canBlock=true;
            for(let s of this.sigils){
                if(s.funcs.onDealtAttack!=null){
                    await s.funcs.onDealtAttack(this,opp,s.data);
                }
            }

            if(opp==null){
                game.tiltScales(this.attack,this,t);
                await game.sleep(500);
            }
            else{
                await this.hit(opp);
            }

            game.attacked=opp;
            await game.resolveDamage();
            if(this.pos==null){
                break;
            }
        }
        game.targets=null;
        blockActions--;
        updateBlockActions();

        if(Math.abs(game.scales)>=game.tippingPoint){
            game.itsOver();
        }
    }

    canPlay(){
        return checkCost(this.card.element,this.card.cost);
    }
}

const dirs=[1,-1];
let listenerRefs=["deathListeners", "playListeners", "attackListeners", "dmgListeners", "turnEndListeners", "faceListeners", "movementListeners","drawListeners"];
let listenerFuncs=["onCardDied", "onCardPlayed", "onReceivedAttack", "onReceivedDmg", "onTurnEnded", "onFaceDmg", "onCardMoved","onCardDrawn"];
const extSource=0;

class Game{
    constructor(_manas,myTurn,tippingPoint=5,lanes=4){
        this.starts=[0,lanes-1];
        this.ends=[lanes,-1];
        this.tippingPoint=tippingPoint;
        this.manas=_manas;
        this.lanes=lanes;

        this.board=[];
        this.buffs=[];
        for(let j=0; j<2; j++){
            this.board[j]=[];
            this.buffs[j]=[];
            for(let i=0; i<lanes; i++){
                this.board[j].push(null);
                this.buffs[j].push(0);
            }
        }

        this.myTurn=myTurn;
        let that=this;
        this.over=new Promise((resolve)=>{
            that.overProm=resolve;
        });
        this.overBool=false;
        this.timeouts=new Set();

        this.deathListeners=[[],[]];
        this.playListeners=[[],[]];
        this.attackListeners=[[],[]];
        this.dmgListeners=[[],[]];
        this.turnEndListeners=[[],[]];
        this.faceListeners=[[],[]];
        this.movementListeners=[[],[]];
        this.drawListeners=[[],[]];
    }

    freshStart(deck,startCards=3,startMana=1){
        this.turn=0;
        this.deck=deck.slice(0);
        shuffle(this.deck);
        this.energy=[0,0];
        this.maxEnergy=[0,0];
        this.manasLeft=[numManas,numManas];
        this.oppCardsLeft=minCards;
        this.bones=[0,0];
        this.scales=0;
        this.startCards=startCards;
        this.startMana=startMana;

        this.energize();
        this.hand=[];
        this.oppCards=0;

        const startDelay=1000,cardDelay=600;
        let that=this;
        for(let i=0; i<startCards; i++){
            this.timeout(function(){
                that.drawCard(0,0);
                that.drawCard(0,1);
            },startDelay+i*cardDelay);
        }
        for(let i=0; i<startMana; i++){
            this.timeout(function(){
                that.drawCard(1,0);
                that.drawCard(1,1);
            },startDelay+startCards*cardDelay);
        }

        blockActions=+(this.turn!=this.myTurn);
        updateBlockActions();
    }

    initConstants(){
        this.dmgQueue=[];
        this.deathQueue=[];
        this.canBlock=true;
        this.targets=null;
        this.isResolvingDamage=false;
        this.isResolvingDeaths=false;
        this.attacked=null;
        this.attackTimeout=null;

        for(let j=0; j<2; j++){
            updateBones(j,this);
        }
        this.updateControls();
    }

    save(){
        return{
            turn: this.turn,
            deck: this.deck,
            energy: this.energy,
            maxEnergy:this.maxEnergy,
            manasLeft: this.manasLeft,
            oppcardsLeft:this.oppCardsLeft,
            bones: this.bones,
            scales:this.scales,
            hand: this.hand,
            oppCards:this.oppCards,

            manas: this.manas,
            myTurn: this.myTurn,
            tippingPoint: this.tippingPoint
        }
    }

    sleep(ms){
        return Promise.any([new Promise((resolve) => {
            setTimeout(resolve,ms);
        }),this.over]);
    }

    timeout(fn,ms){
        if(this.overBool) return;
        let that=this;
        let id=setTimeout(function(){
            fn();
            that.timeouts.delete(id);
        },ms);
        that.timeouts.add(id);
        return id;
    }

    clrTimeout(id){
        clearTimeout(id);
        this.timeouts.delete(id);
    }

    itsOver(){
        if(game.overBool) return;
        unselectCard();
        cancelHammer();
        isSaccing=true;
        blockActions++;
        updateBlockActions();
        nuhuh.style.transitionDuration="100ms";
        nuhuh.style.opacity="0";
        respQueue.clear();
        promQueue.clear();

        setTimeout(function(){
            fader.classList.add("fade"); 
        },250);

        setTimeout(function(){
            this.overProm();
            this.overBool=true;
            for (const t of this.timeouts) {
                clearTimeout(t);
            }
            clearInterval(scaleIntv);

            menu.style.visibility="visible";
            playScr.style.visibility="hidden";
            fader.classList.remove("fade");
            hoveredTT=null;
            tooltip.style.opacity=0;
            tooltip.style.visibility="hidden";

            for(let i=0; i<2; i++){
                hands[i].innerHTML="";
                for(let j=0; j<cardSpacesBase[i].length; j++){
                    cardSpacesBase[i][j].innerHTML="";
                    boardOverlaysBase[i][j].innerHTML="";
                }
                for(let j=0; j<6; j++){
                    energyBars[i][j].src="icons/energy_empty.png";
                }
            }
        }.bind(this),1500);
    }

    energize(){
        if(this.maxEnergy[this.turn]<6){
            this.maxEnergy[this.turn]++;
        }
        this.energy=[...this.maxEnergy];

        const uiTurn=+(this.turn!=this.myTurn);
        for(let i=5; i>5-this.maxEnergy[this.turn]; i--){
            energyBars[uiTurn][i].src="icons/energy_full.png";
        }
    }

    async tiltScales(pow,attacker,target){
        for(let l of [...game.faceListeners[1-attacker.side]]){
            pow=await l.func(pow,l.caller,attacker,target,l.data);
        }
        this.scales+=pow*(this.turn==0? 1: -1);
        updateScale(pow*(this.turn==this.myTurn? 1: -1));
    }

    async resolveDeaths(){
        if(this.isResolvingDeaths || this.deathQueue.length==0) return;
        this.isResolvingDeaths=true;

        let delay=0;
        for(let i=0; i<this.deathQueue.length; i++){
            let card=this.deathQueue[i];
            if(!card.inGame) continue;

            for(let s of card.sigils){
                for(let f of s.funcs.onCardDied){
                    await f.func(card,card,s.data);
                }
            }
            card.inGame=false;

            if(card.health>0){
                die(card);
            }
            else{
                delay=250;
                this.timeout(function(){
                    die(card);
                }.bind(this),delay);
            }

            for(let ref of listenerRefs){
                for(let i=0; i<2; i++){
                    let l2=[];
                    a: for(let l of this[ref][i]){
                        for(let j=0; j<this.deathQueue.length; j++){
                            if(l.caller==this.deathQueue[j]){
                                continue a;
                            }
                        }
                        if(ref=="deathListeners" && i==card.side) await l.func(l.caller,card,l.data);
                        l2.push(l);
                    }
                    this[ref][i]=l2;
                }
            }

            if(card.pos!=null){
                this.board[card.side][card.pos]=null;
                this.bones[card.side]++;
            }
        }

        this.deathQueue=[];
        this.isResolvingDeaths=false;
        await this.resolveDamage();

        updateBones(0);
        updateBones(1);
    }

    async resolveDamage(){
        if(this.isResolvingDamage) return;
        if(this.dmgQueue.length==0){
            if(this.deathQueue.length>0){
                await this.resolveDeaths();
            }
            return;
        }

        this.isResolvingDamage=true;
        for(let h=0; h<this.dmgQueue.length; h++){
            const card=this.dmgQueue[h].card;
            if(card.health<=0 || !card.inGame) continue;

            for(let s of card.sigils){
                for(let f of s.funcs.onReceivedDmg){
                    this.dmgQueue[h].dmg=await f.func(this.dmgQueue[h].dmg,card,card,s.data);
                }
            }

            a: for(let l of [...game.dmgListeners[card.side]]){
                for(let j=0; j<this.dmgQueue.length; j++){
                    if(l.caller==this.dmgQueue[j].card){
                        continue a;
                    }
                }
                this.dmgQueue[h].dmg=await l.func(this.dmgQueue[h].dmg,l.caller,card,l.data);
            }
        }

        let q2=[];
        for(let h=0; h<this.dmgQueue.length; h++){
            const card=this.dmgQueue[h].card;
            if(card.health>0 && card.inGame && this.dmgQueue[h].dmg>0){
                q2.push(this.dmgQueue[h]);
            }
        }

        this.dmgQueue=q2;
        for(let h=0; h<this.dmgQueue.length; h++){
            const card=this.dmgQueue[h].card;

            if(this.dmgQueue[h].src!=null){
                for(let s of card.sigils){
                    if(s.funcs.onDealtDmg!=null){
                        this.dmgQueue[h].dmg=await s.funcs.onDealtDmg(this.dmgQueue[h].dmg,this.dmgQueue[h].src,card,s.data);
                    }
                }
            }

            card.health-=this.dmgQueue[h].dmg;
            if(card.health<=0){
                this.deathQueue.push(card);
            }

            let hp=card.health;
            if(card==this.attacked){
                this.attacked=null;
                this.timeout(function(){
                    card.updateStat(1,hp);
                },250);
                await this.sleep(500);
            }
            else{
                this.timeout(function(){
                    card.updateStat(1,hp);
                },100);
                if(this.dmgQueue[h].src!=extSource) damage(+(card.side!=game.myTurn),card.pos);
            }
        }
        
        this.dmgQueue=[];
        this.isResolvingDamage=false;
        await this.sleep(500);
        await this.resolveDeaths();
    }

    async resolve(isTurnEnd=false){
        await this.resolveDamage();
        this.updateControls(isTurnEnd);

        for(let i=0; i<listenerRefs.length; i++){
            const pools=game[listenerRefs[i]];

            for(let side=0; side<pools.length; side++){
                const pool=pools[side];
                for(let k=1; k<pool.length; k++){
                    let place=k-1;
                    let temp=pool[k];
                    while(place>=0){
                        if(pool[k].prio<pool[place].prio) break;
                        if(side==0){
                            if(pool[k].caller.pos>pool[place].caller.pos) break;
                        }
                        else{
                            if(pool[k].caller.pos<pool[place].caller.pos) break;
                        }
                        pool[place+1]=pool[place];
                        place--;
                    }
                    pool[place+1]=temp;
                }
            }
        }
    }

    async updateControls(isTurnEnd=false){
        if(isTurnEnd != (this.turn==this.myTurn)) this.updateActivated();
        else if(this.turn==this.myTurn){
            for(let i=0; i<this.lanes; i++){
                const card=this.board[this.myTurn][i];
                if(card!=null && card.activated!=null){
                    card.sigilEls[0].classList.remove("enabled");
                }
            }
        }
    }

    async addCardToHand(card,side=this.turn,func=null,justPlayed=false,unsac=false){
        let canvas,c=null;
        if(side==this.myTurn){
            c=GameCard.fromCard(card,unsac);
        }
        for(let l of [...game.drawListeners[this.turn]]){
            await l.func(l.caller,c,l.data);
        }

        if(side==this.myTurn){
            this.hand.push(c);
            if(func){
                func(c);
            }
            canvas=c.canvas;

            c.clickEvent=function(){
                if(blockActions) return;

                if(c.canPlay()){
                    if(c==selectedCard) unselectCard();
                    else{
                        selectCard(c);
                    }
                }
                else{
                    c.canvas.classList.remove("shake");
                    void c.canvas.offsetHeight;
                    c.canvas.classList.add("shake");
                    setTimeout(function(){
                        c.canvas.classList.remove("shake");
                    },400)
                }
            };
            c.canvas.addEventListener("click",c.clickEvent);
        }
        else{
            this.oppCards++;
            canvas=copyCanvas(deckPiles[1][0]);
        }

        cardDrawStage2(canvas,+(side!=this.myTurn),justPlayed);
        return c;
    }

    async drawCard(manaOrCard,side=this.turn){
        let card=null,cardsLeft;
        if(side==this.myTurn){
            if(manaOrCard==1){
                card=manas[this.manas[side]];
                cardsLeft=--this.manasLeft[side];
            }
            else{
                card=cards[this.deck.pop()];
                // card=c_beaver;
                cardsLeft=this.deck.length;
            }
        }
        else{
            if(manaOrCard==1){
                cardsLeft=--this.manasLeft[side];
            }
            else{
                cardsLeft=--this.oppCardsLeft;
            }
        }

        const uiSide=+(side!=this.myTurn);
        drawDeckShadow(uiSide,manaOrCard,cardsLeft);
        cardDrawStage1(uiSide,manaOrCard);
        let that=this;
        this.timeout(function(){
            that.addCardToHand(card,side);
        },500);
    }

    updateActivated(){
        for(let i=0; i<this.lanes; i++){
            const card=this.board[this.myTurn][i];
            if(card!=null && card.activated!=null){
                card.activated.enabled=card.activated.funcs.conds(card,card.activated.data,card.activated.funcs);
                if(card.activated.enabled){
                    card.sigilEls[0].classList.add("enabled");
                }
                else{
                    card.sigilEls[0].classList.remove("enabled");
                }
            }
        }
    }

    async endTurn(){
        if(this.turn==this.myTurn){
            blockActions++;
            updateBlockActions();
        }
        
        for(let i=game.starts[this.turn]; i!=game.ends[this.turn]; i+=dirs[this.turn]){
            if(this.board[this.turn][i]!=null){
                await this.board[this.turn][i]._attack();
            }   
        }

        for(let l of [...game.turnEndListeners[this.turn]]){
            await l.func(l.caller,l.data);
        }
        await game.resolve(true);

        this.turn=1-this.turn;
        this.energy[this.turn]=this.maxEnergy[this.turn];
        game.energize();

        // await new Promise(function(resolve) {
        //     setTimeout(resolve, 350);
        // });

        if(this.turn==this.myTurn){
            if(this.deck.length==0 && this.manasLeft[this.turn]==0){
                blockActions--;
                updateBlockActions();
            }
            else{
                const rect=myDecks.getBoundingClientRect();
                drawOverlay.style.top=rect.top-nuhuhPadding+"px";
                drawOverlay.style.left=rect.left-nuhuhPadding+"px";
                nuhuh.style.transitionDuration="300ms";
                nuhuh.style.opacity="0.5";

                let that=this,wtf=false;
                for(let i=0; i<2; i++){
                    async function myFunc(){
                        if(wtf) return;
                        for(let j=0; j<2; j++){
                            deckPiles[0][j].removeEventListener("click", myFunc);
                            deckPiles[0][j].style.cursor="";
                        }
                        nuhuh.style.transitionDuration="100ms";
                        nuhuh.style.opacity="0";
                        sendMsg(codeDecision+" "+i);
                        await that.drawCard(i);
                        blockActions--;
                        updateBlockActions();
                        wtf=true;
                    }
                    deckPiles[0][i].addEventListener("click",myFunc);
                    deckPiles[0][i].style.cursor="pointer";
                }
            }
        }
    }

    async opponentsTurn(){
        while(true){
            let msg=await getNextMsg();
            switch (msg[0]){
                case codeActivated:
                    let actPos=parseInt(msg.substring(2));
                    let actCard=this.board[game.turn][actPos];
                    await actCard.activate();
                    break;

                case codePlayedCard:
                    const spl=msg.substring(2).split(" ");
                    const minSize=2+GameCard.toSocketLen;

                    if(spl.length>minSize){
                        for(let i=minSize; i<spl.length; i++){
                            const sacPos=parseInt(spl[i]);
                            sacAnim(this.board[this.turn][sacPos],1,sacPos);
                        }
                        sacrifice();
                        await game.resolve();
                        await this.sleep(200);
                    }

                    let pos=parseInt(spl[0]),handPos=parseInt(spl[1]),id=parseInt(spl[2]),attack=parseInt(spl[3]),health=parseInt(spl[4]),unsac=parseInt(spl[5]);

                    const faceDown=hands[1].children[handPos];
                    await GameCard.fromCard(allCards[id],unsac==1,attack,health).play(pos,faceDown);
                    break;

                case codeHammered:
                    let hammeredPos=parseInt(msg.substring(2));
                    let hammeredCard=this.board[game.turn][hammeredPos];
                    hammeredCard.die();
                    await game.resolve();
                    break;

                case codeEndedTurn:
                    await this.endTurn();
                    return;
                
                case codeDecision:
                    let manaOrDeck=parseInt(msg.substring(2));
                    await this.drawCard(manaOrDeck);
                    break;

                default:
                    throw new Error(msg+"???");
            }
        }
    }

    updateBuffs(side,pos,qtd){
        this.buffs[side][pos]+=qtd;
        const aff=this.board[side][pos];
        if(aff!=null){
            aff.attack+=qtd;
            aff.updateStat(0,aff.attack);
        }
    }
}
