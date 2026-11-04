using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShelfMate.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AccountLoginThrottle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FailedLoginCount",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "FailedLoginWindowStartedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FailedLoginCount",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "FailedLoginWindowStartedAt",
                table: "Users");
        }
    }
}
