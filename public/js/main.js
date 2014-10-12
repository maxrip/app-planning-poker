var socket
$(function(){
	var id = Number(window.location.pathname.match(/\/room\/(\d+)$/)[1]);

	 socket = io.connect('/socket');

	// блоки на странице
	var 
		b_login= $('.b-login'),
		b_invite_textfield= $('.b-invite-textfield'),
		b_start_round= $('.b-start-round'),
		b_users= $('.b-users'),
		b_cart= $('.b-cart'),
		b_carts= $('.b-carts')
		b_carts_users= $('.b-carts-users')



	socket.on('connect', function(){
		socket.emit('load', id);
	});




	socket.on('peopleinroom', function(data){
		console.log(data);
		b_login.show()
		b_carts_users.hide();
		b_cart.hide();
		if(typeof data.message != "undefined"){
			$('.message',b_login).text(data.message)
		}
		$('form',b_login).on('submit', function(e){
			e.preventDefault();
			var name = $('#yourName').val().trim()
			if(name.length < 1){
				alert("Имя слишком короткое ;)");
				return;
			}
			socket.emit('login', {user: name, id: id});
			$('form',b_login).off('submit');
			b_login.hide()
		})
	})





	socket.on('update-users', function(data){
		if(b_users.is(':hidden')){
			b_users.show();
		}
		b_users.find('ul').html(ejs.render(template.users, {users:data.users}));
	})





	socket.on('offer-begin-round', function(data){
		b_carts_users.hide();
		b_cart.hide();
		if(!b_invite_textfield.is(':hidden')){
			b_invite_textfield.hide()
		}
		if(b_start_round.is(':hidden')){
			b_start_round.show();
			$('form',b_start_round).on('submit', function(e){
				e.preventDefault();
				var roundInfo = $('#iRoundInfo').val().trim()
	
				socket.emit('begin-round', {roundInfo: roundInfo, id: id});
				$('form',b_start_round).off('submit');
				b_start_round.hide()
				$('form',b_start_round).off('submit');
			})
		}
	})





	socket.on('invite', function(data){
		b_invite_textfield.show();
		b_invite_textfield.find('a').text(window.location.href);
	})




	socket.on('begin-round', function(data){
		b_start_round.hide();
		b_invite_textfield.hide();
		b_carts.html(ejs.render(template.carts, {carts:data.carts})).show();
		if(typeof data.roundInfo != "undefined"){
			$('#roud-info').text(data.roundInfo)
		}
		b_cart.show()
		b_cart.on("change","input",function(){
			b_cart.find('li').addClass('disabled');
			b_cart.find('input').prop("disabled");
			$(this).parent().addClass('selected');
			$('input',b_cart).off('change');
			socket.emit('seleced-value', {i: $(this).val(), id: id});
		})
	})




	socket.on('finish-round', function(data){
		b_carts.hide();
		b_carts_users.html(ejs.render(template.users_cart, {
			carts:data.carts,
			usersVoted:data.usersVoted,
			users:data.users
		})).show();
		$('#new-round').on('click',function(e){
			e.preventDefault();
			socket.emit('reset-round', {id: id});
		}).show()
	})
});