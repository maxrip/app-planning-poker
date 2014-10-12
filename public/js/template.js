var template={
	users:"<% for(var user in users) { %><li class=\"user <%= users[user]==1?'voted':'not-voted' %>\"><%=user%></li><% } %>",
	carts:"<% for(var i=0; i<carts.length; i++) { %><li class=\"cart\"><input type=\"radio\" value=\"<%=i%>\" id=\"cart-<%=i%>\" /><label class=\"cart-button\" for=\"cart-<%=i%>\"><%=carts[i]%></label></li> <% } %>",
	users_cart:"<% for(var user in users) { %><li class=\"cart\"><span class=\"user-name\"><%=user%></span><br><span class=\"cart-button\"><%=carts[usersVoted[user]]%></span></li> <% } %>"
}