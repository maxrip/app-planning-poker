var template={
	users:"<% for(var user in users) { %><li class=\"user <%= users[user].isVoted?'voted':'not-voted' %>\"><%=users[user].name%></li><% } %>",
	carts:"<% for(var i=0; i<carts.length; i++) { %><li class=\"cart\"><input type=\"radio\" value=\"<%=i%>\" id=\"cart-<%=i%>\" /><label class=\"cart-button\" for=\"cart-<%=i%>\"><%=carts[i]%></label></li> <% } %>",
	users_cart:"<% for(var user in users) {if(users[user].value) { %><li class=\"cart\"><span class=\"user-name\"><%=users[user].name%></span><br><span class=\"cart-button\"><%=carts[users[user].value]%></span></li> <% }} %> "
}